/**
 * Rich link previews for chat messages.
 *
 * When a message carries a link, the page is fetched once here and its Open
 * Graph metadata written back onto the message. Doing it server side means the
 * page is fetched once per URL rather than once per participant per device,
 * the result is identical on both sides of the conversation, and the reader's
 * IP address is never handed to whatever was linked.
 */

import {createHash} from "crypto";
import {promises as dns} from "dns";
import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";
import {isIP} from "net";

import {db} from "./admin";

const FETCH_TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
/** Enough for any sane <head>; the rest of the page is of no interest. */
const MAX_BYTES = 512 * 1024;
const CACHE_COLLECTION = "linkPreviews";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Bumped whenever a card made by an older build would come out wrong. Cards
 * and cache entries below it are rebuilt on sight, which beats migrating
 * every message that already has one.
 */
export const PREVIEW_VERSION = 2;

const URL_IN_TEXT = /(?:https?:\/\/|www\.)[^\s<>"']+/i;

export type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  version?: number;
};

/**
 * Whether an address sits inside the network the function runs in. Fetching a
 * user-supplied URL from a trusted host is a request-forgery primitive unless
 * the destination is checked, on every redirect hop as well as the first.
 *
 * @param {string} address IPv4 or IPv6 address to classify.
 * @return {boolean} True when the address is private, local or unroutable.
 */
const isPrivateAddress = (address: string): boolean => {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("::ffff:")
    );
  }
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
};

/**
 * Whether a URL may be fetched from the backend.
 *
 * @param {URL} candidate URL to check.
 * @return {Promise<boolean>} True when it is public http(s).
 */
const isSafeUrl = async (candidate: URL): Promise<boolean> => {
  if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
    return false;
  }
  try {
    const resolved = await dns.lookup(candidate.hostname, {all: true});
    if (resolved.length === 0) return false;
    return !resolved.some((entry) => isPrivateAddress(entry.address));
  } catch {
    return false;
  }
};

const decodeEntities = (value: string): string =>
  value
    // Numeric forms first, and hex as well as decimal: page titles are full of
    // &#x27; and &#xb7;, and leaving them raw puts the escape on screen.
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Reads a meta tag's content, whichever order its attributes appear in.
 *
 * @param {string} html Document source to search.
 * @param {string[]} keys Property or name values to try, in order.
 * @return {string | undefined} The first content found, decoded.
 */
const metaContent = (html: string, keys: string[]): string | undefined => {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*?` +
          "content\\s*=\\s*[\"']([^\"']*)[\"']",
        "i",
      ),
      new RegExp(
        "<meta[^>]+content\\s*=\\s*[\"']([^\"']*)[\"'][^>]*?" +
          `(?:property|name)\\s*=\\s*["']${escaped}["']`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]?.trim()) return decodeEntities(match[1]);
    }
  }
  return undefined;
};

/**
 * Follows redirects by hand so every hop is checked, not just the first.
 *
 * Exported, with buildPreview, so both can be run against real pages offline.
 *
 * @param {URL} startUrl Where to begin.
 * @return {Promise<{html: string, finalUrl: URL} | null>} Page source and the
 *   URL it finally came from, or null when it could not be read safely.
 */
export const fetchHtml = async (
  startUrl: URL,
): Promise<{html: string; finalUrl: URL} | null> => {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!(await isSafeUrl(current))) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Plenty of sites serve Open Graph tags only to something that looks
          // like a crawler, and others refuse an unfamiliar agent outright.
          "user-agent": "Mozilla/5.0 (compatible; BarTalkBot/1.0)",
          "accept": "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) return null;

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("html")) return null;

      const buffer = await response.arrayBuffer();
      const html = Buffer.from(buffer.slice(0, MAX_BYTES)).toString("utf8");
      return {html, finalUrl: current};
    } catch (error) {
      functions.logger.info("Link preview fetch failed", {
        url: current.toString(),
        error: String(error),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
};

/**
 * Turns page source into the card a message will show.
 *
 * @param {string} html Page source.
 * @param {URL} finalUrl The URL the source came from, after redirects.
 * @return {LinkPreview | null} The card, or null when there is too little.
 */
export const buildPreview = (
  html: string,
  finalUrl: URL,
): LinkPreview | null => {
  const title =
    metaContent(html, ["og:title", "twitter:title"]) ??
    decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = metaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const rawImage = metaContent(html, [
    "og:image:secure_url",
    "og:image:url",
    "og:image",
    "twitter:image",
    "twitter:image:src",
  ]);
  const siteName =
    metaContent(html, ["og:site_name", "application-name"]) ??
    finalUrl.hostname.replace(/^www\./i, "");

  let imageUrl: string | undefined;
  if (rawImage) {
    try {
      const resolved = new URL(rawImage, finalUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        imageUrl = resolved.toString();
      }
    } catch {
      imageUrl = undefined;
    }
  }

  // A card with neither a picture nor a title says less than the link itself.
  if (!title && !imageUrl) return null;

  const preview: LinkPreview = {
    url: finalUrl.toString(),
    siteName,
    version: PREVIEW_VERSION,
  };
  if (title) preview.title = title.slice(0, 200);
  if (description) preview.description = description.slice(0, 300);
  if (imageUrl) preview.imageUrl = imageUrl;
  return preview;
};

const cacheKey = (url: string) =>
  createHash("sha1").update(url).digest("hex");

const writeCache = async (url: string, preview: LinkPreview | null) => {
  try {
    await db
      .collection(CACHE_COLLECTION)
      .doc(cacheKey(url))
      .set({url, preview, fetchedAt: Date.now(), version: PREVIEW_VERSION});
  } catch (error) {
    functions.logger.info("Could not cache link preview", {
      error: String(error),
    });
  }
};

/**
 * Works out the card for a stored message, using the shared URL cache.
 *
 * The URL is always taken from the message itself, never from a caller, so
 * this can be reached from a callable without becoming an open fetch proxy.
 *
 * @param {FirebaseFirestore.DocumentData} message The message document.
 * @return {Promise<LinkPreview | null>} The card, or null when there is none.
 */
const resolvePreviewForMessage = async (
  message: FirebaseFirestore.DocumentData,
): Promise<LinkPreview | null> => {
  // A message that already shows a picture does not also want a card.
  const hasMedia =
    (Array.isArray(message.media) && message.media.length > 0) ||
    Boolean(message.image?.url);
  if (hasMedia) return null;

  const text = typeof message.text === "string" ? message.text : "";
  const found = text.match(URL_IN_TEXT)?.[0];
  if (!found) return null;

  const normalized = /^https?:\/\//i.test(found) ? found : `https://${found}`;
  let target: URL;
  try {
    target = new URL(normalized);
  } catch {
    return null;
  }

  const cacheDoc = await db
    .collection(CACHE_COLLECTION)
    .doc(cacheKey(target.toString()))
    .get();
  const cachedData = cacheDoc.data();
  const fetchedAt = cachedData?.fetchedAt ?? 0;
  const isFresh =
    Boolean(cachedData) &&
    cachedData?.version === PREVIEW_VERSION &&
    Date.now() - fetchedAt <= CACHE_TTL_MS;
  if (isFresh) {
    return (cachedData?.preview as LinkPreview | undefined) ?? null;
  }

  const fetched = await fetchHtml(target);
  const preview = fetched ? buildPreview(fetched.html, fetched.finalUrl) : null;
  // A miss is cached too: a page with no card should not be refetched by
  // every device that scrolls past the message.
  await writeCache(target.toString(), preview);
  return preview;
};

export const attachLinkPreview = runWith({maxInstances: 10, timeoutSeconds: 30})
  .firestore
  .document("conversations/{conversationId}/messages/{messageId}")
  .onCreate(
    async (
      snap: functions.firestore.DocumentSnapshot,
      context: functions.EventContext,
    ) => {
      const message = snap.data();
      if (!message) return null;

      const preview = await resolvePreviewForMessage(message);
      if (!preview) return null;

      try {
        await snap.ref.update({linkPreview: preview});
      } catch (error) {
        functions.logger.warn("Could not attach link preview", {
          conversationId: context.params.conversationId,
          messageId: context.params.messageId,
          error: String(error),
        });
      }
      return null;
    },
  );

/**
 * Fills in the card for a message that predates the trigger.
 *
 * Called by the app when it renders a message that carries a link but has no
 * card, so history fills in as it is read rather than in one sweep over
 * conversations nobody opens.
 *
 * @return {Promise<{preview: LinkPreview | null}>} The card, if there is one.
 */
export const requestLinkPreview = runWith({
  maxInstances: 10,
  timeoutSeconds: 30,
})
  .https
  .onCall(async (data: unknown, context: functions.https.CallableContext) => {
    const callerId = context.auth?.uid;
    if (!callerId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to load link previews.",
      );
    }

    const {conversationId, messageId} = (data ?? {}) as {
      conversationId?: unknown;
      messageId?: unknown;
    };
    if (typeof conversationId !== "string" || typeof messageId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "A conversation and message are required.",
      );
    }

    const conversation = await db
      .collection("conversations")
      .doc(conversationId)
      .get();
    const participants = conversation.data()?.participants;
    if (!Array.isArray(participants) || !participants.includes(callerId)) {
      // Same answer whether the conversation is missing or simply not theirs,
      // so this cannot be used to discover which conversations exist.
      throw new functions.https.HttpsError(
        "permission-denied",
        "That conversation is not yours.",
      );
    }

    const messageRef = conversation.ref.collection("messages").doc(messageId);
    const messageSnap = await messageRef.get();
    const message = messageSnap.data();
    if (!message) return {preview: null};
    const existing = message.linkPreview as LinkPreview | undefined;
    if (existing && existing.version === PREVIEW_VERSION) {
      return {preview: existing};
    }

    const preview = await resolvePreviewForMessage(message);
    if (!preview) return {preview: null};

    try {
      await messageRef.update({linkPreview: preview});
    } catch (error) {
      functions.logger.warn("Could not backfill link preview", {
        conversationId,
        messageId,
        error: String(error),
      });
    }
    return {preview};
  });
