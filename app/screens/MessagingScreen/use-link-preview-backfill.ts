import { useEffect } from "react";
import { requestLinkPreview } from "../../../api";
import type { MessageDoc } from "../../types/firestore";
import { hasLink } from "../../utils/linkify";
import { getMessageMedia } from "./utils";

/**
 * Messages already asked about this run. A miss is cached on the backend by
 * URL, so a retry next launch is cheap; asking twice in one sitting is not.
 */
const requested = new Set<string>();

/** At most this many in flight, so opening a chat full of links stays calm. */
const MAX_CONCURRENT = 3;
let inFlight = 0;
const queue: (() => void)[] = [];

const runNext = () => {
  if (inFlight >= MAX_CONCURRENT) return;
  const next = queue.shift();
  if (!next) return;
  inFlight += 1;
  next();
};

const schedule = (task: () => Promise<void>) => {
  queue.push(() => {
    void task().finally(() => {
      inFlight -= 1;
      runNext();
    });
  });
  runNext();
};

/**
 * Fills in the card for a message written before link previews existed.
 *
 * Runs from the message row, so only history actually scrolled to is fetched
 * — a sweep over every conversation would fetch pages nobody is reading. The
 * card arrives through the existing Firestore listener once the backend
 * writes it, so nothing here has to hold the result.
 */
export const useLinkPreviewBackfill = (
  conversationId: string | null,
  message: MessageDoc,
) => {
  useEffect(() => {
    if (!conversationId) return;
    if (message.linkPreview) return;
    if (getMessageMedia(message).length > 0) return;

    const text = typeof message.text === "string" ? message.text : "";
    if (text.trim().length === 0 || !hasLink(text)) return;

    const key = `${conversationId}:${message.id}`;
    if (requested.has(key)) return;
    requested.add(key);

    schedule(async () => {
      try {
        await requestLinkPreview(conversationId, message.id);
      } catch (error) {
        // A missing card is not worth interrupting anyone over.
        console.warn("Could not load a link preview:", error);
      }
    });
  }, [conversationId, message]);
};
