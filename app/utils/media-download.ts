// Getting a chat attachment out of the app: into the photo library, into
// another app, or onto the clipboard.
//
// Saving goes through expo-media-library, which drops the file straight into
// Photos. When the user has refused that permission we fall back to the share
// sheet, where "Save Image" reaches the same place without a permission of our
// own — a refusal shouldn't leave them with no way to keep the picture.

import * as Clipboard from "expo-clipboard";
import { Directory, File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import type { MessageMedia } from "../types/firestore";

const DOWNLOAD_DIRECTORY_NAME = "bartalk-downloads";

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  "3gp": "video/3gpp",
};

/** The subset of a `MessageMedia` any of these operations needs. */
export type SaveableMedia = Pick<
  MessageMedia,
  "url" | "storagePath" | "fileName" | "mimeType" | "type"
>;

export type MediaActionResult =
  | { status: "ok" }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/**
 * The extension to give the local file. Storage download URLs carry a query
 * string, so the name has to come from the stored path rather than the URL.
 */
const resolveExtension = (media: SaveableMedia) => {
  const fromName = (media.fileName ?? "").match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  const fromPath = (media.storagePath ?? "").match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromPath) return fromPath.toLowerCase();
  const fromUrl = media.url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  return media.type === "video" ? "mp4" : "jpg";
};

const resolveMimeType = (media: SaveableMedia, extension: string) =>
  media.mimeType ??
  EXTENSION_TO_MIME[extension] ??
  (media.type === "video" ? "video/mp4" : "image/jpeg");

/** A filename that reads like something the user chose to keep. */
const buildFileName = (extension: string) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `BarTalk-${stamp}.${extension}`;
};

const isRemote = (url: string) => /^https?:/i.test(url);

/**
 * Pulls the attachment into a scratch directory. The caller deletes it when
 * it is finished — except for sharing, where the sheet outlives the call.
 */
const downloadToCache = async (url: string, fileName: string): Promise<File> => {
  const directory = new Directory(Paths.cache, DOWNLOAD_DIRECTORY_NAME);
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
  const destination = new File(directory, fileName);
  if (destination.exists) {
    destination.delete();
  }
  await File.downloadFileAsync(url, destination);
  return destination;
};

const discard = (file: File | null) => {
  if (!file) return;
  try {
    if (file.exists) file.delete();
  } catch {
    // A leftover file in the cache directory is the system's problem, not ours.
  }
};

const failure = (media: SaveableMedia, verb: string): MediaActionResult => ({
  status: "failed",
  reason: `Couldn't ${verb} that ${media.type === "video" ? "video" : "photo"}. Please try again.`,
});

/** Saves one attachment into the device's photo library. */
export const saveMediaToDevice = async (
  media: SaveableMedia,
): Promise<MediaActionResult> => {
  if (!isRemote(media.url)) {
    return { status: "failed", reason: "This attachment has no file to save." };
  }

  const extension = resolveExtension(media);
  const fileName = buildFileName(extension);
  let downloaded: File | null = null;

  try {
    downloaded = await downloadToCache(media.url, fileName);

    // writeOnly: we only ever add to the library, so asking for read access
    // would be asking for more than the feature needs.
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (permission.granted) {
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      return { status: "ok" };
    }

    // Permission refused — the share sheet still has "Save Image".
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloaded.uri, {
        mimeType: resolveMimeType(media, extension),
        UTI: media.type === "video" ? "public.movie" : "public.image",
      });
      return { status: "ok" };
    }

    return {
      status: "failed",
      reason: "BarTalk needs permission to add to your photo library.",
    };
  } catch (error) {
    console.error("Failed to save media:", error);
    return failure(media, "save");
  } finally {
    discard(downloaded);
  }
};

/** Hands one attachment to the system share sheet. */
export const shareMedia = async (
  media: SaveableMedia,
): Promise<MediaActionResult> => {
  if (!isRemote(media.url)) {
    return { status: "failed", reason: "This attachment has no file to share." };
  }
  if (!(await Sharing.isAvailableAsync())) {
    return { status: "failed", reason: "Sharing isn't available on this device." };
  }

  const extension = resolveExtension(media);
  try {
    // Not deleted afterwards: the sheet reads the file after this resolves,
    // and it lives in the cache directory the system reclaims on its own.
    const downloaded = await downloadToCache(media.url, buildFileName(extension));
    await Sharing.shareAsync(downloaded.uri, {
      mimeType: resolveMimeType(media, extension),
      UTI: media.type === "video" ? "public.movie" : "public.image",
    });
    return { status: "ok" };
  } catch (error) {
    console.error("Failed to share media:", error);
    return failure(media, "share");
  }
};

/**
 * Puts one attachment on the clipboard: the image itself where the platform
 * supports it, and the link for a video, which no clipboard takes.
 */
export const copyMediaToClipboard = async (
  media: SaveableMedia,
): Promise<MediaActionResult> => {
  if (!isRemote(media.url)) {
    return { status: "failed", reason: "This attachment has nothing to copy." };
  }

  if (media.type === "video") {
    try {
      await Clipboard.setStringAsync(media.url);
      return { status: "ok" };
    } catch (error) {
      console.error("Failed to copy video link:", error);
      return failure(media, "copy");
    }
  }

  let downloaded: File | null = null;
  try {
    downloaded = await downloadToCache(
      media.url,
      buildFileName(resolveExtension(media)),
    );
    await Clipboard.setImageAsync(await downloaded.base64());
    return { status: "ok" };
  } catch (error) {
    console.error("Failed to copy image:", error);
    return failure(media, "copy");
  } finally {
    discard(downloaded);
  }
};

/**
 * Saves several attachments. Sequential on purpose: the photo library takes
 * them one at a time, and one failure shouldn't abandon the rest.
 */
export const saveAllMediaToDevice = async (
  items: SaveableMedia[],
): Promise<{ saved: number; failed: number }> => {
  let saved = 0;
  let failed = 0;
  for (const item of items) {
    const result = await saveMediaToDevice(item);
    if (result.status === "ok") saved += 1;
    else if (result.status === "failed") failed += 1;
  }
  return { saved, failed };
};
