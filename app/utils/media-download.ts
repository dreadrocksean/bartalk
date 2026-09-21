// Saving a chat attachment onto the phone.
//
// Deliberately built out of modules this binary already ships — expo-file-system
// and React Native's own Share — so the feature can go out over the air instead
// of waiting for a store release. Adding expo-media-library would change the
// fingerprint runtime version, which means existing installs would stop being
// eligible for the update entirely.
//
// iOS hands the downloaded file to the share sheet, where "Save Image" / "Save
// Video" puts it in Photos. Android writes it into a folder the user picks
// through the Storage Access Framework.

import { Directory, File, Paths } from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system/legacy";
import { Platform, Share } from "react-native";
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

export type SaveMediaResult =
  | { status: "saved" }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/**
 * The extension to give the saved file. Storage download URLs carry a query
 * string, so the name has to come from the stored path rather than the URL.
 */
const resolveExtension = (media: Pick<MessageMedia, "url" | "storagePath" | "fileName" | "mimeType" | "type">) => {
  const fromName = (media.fileName ?? "").match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromName) return fromName.toLowerCase();
  const fromPath = (media.storagePath ?? "").match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromPath) return fromPath.toLowerCase();
  const fromUrl = media.url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  return media.type === "video" ? "mp4" : "jpg";
};

const resolveMimeType = (
  media: Pick<MessageMedia, "mimeType" | "type">,
  extension: string,
) =>
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

/**
 * Pulls the attachment into a scratch directory and returns the local file.
 * The caller is responsible for deleting it.
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

/**
 * Saves one attachment to the device. Resolves to `cancelled` when the user
 * backs out of the share sheet or the folder picker, which is not a failure.
 */
export const saveMediaToDevice = async (
  media: Pick<
    MessageMedia,
    "url" | "storagePath" | "fileName" | "mimeType" | "type"
  >,
): Promise<SaveMediaResult> => {
  if (!media.url) {
    return { status: "failed", reason: "This attachment has no file to save." };
  }

  const extension = resolveExtension(media);
  const mimeType = resolveMimeType(media, extension);
  const fileName = buildFileName(extension);
  let downloaded: File | null = null;

  try {
    const file = await downloadToCache(media.url, fileName);
    downloaded = file;

    if (Platform.OS === "android") {
      const permission =
        await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) {
        return { status: "cancelled" };
      }
      const destinationUri = await StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        fileName,
        mimeType,
      );
      await StorageAccessFramework.writeAsStringAsync(
        destinationUri,
        await file.base64(),
        { encoding: "base64" },
      );
      return { status: "saved" };
    }

    // iOS: the share sheet is where "Save Image" and "Save Video" live, and it
    // needs no photo-library permission of our own.
    const result = await Share.share({ url: file.uri });
    return result.action === Share.dismissedAction
      ? { status: "cancelled" }
      : { status: "saved" };
  } catch (error) {
    console.error("Failed to save media:", error);
    return {
      status: "failed",
      reason:
        media.type === "video"
          ? "Couldn't save that video. Please try again."
          : "Couldn't save that photo. Please try again.",
    };
  } finally {
    discard(downloaded);
  }
};

/**
 * Saves several attachments one after another. They are sequential on purpose:
 * on iOS each one opens a share sheet, and on Android each one writes into the
 * folder the user already granted.
 */
export const saveAllMediaToDevice = async (
  items: Parameters<typeof saveMediaToDevice>[0][],
): Promise<{ saved: number; failed: number; cancelled: boolean }> => {
  let saved = 0;
  let failed = 0;
  for (const item of items) {
    const result = await saveMediaToDevice(item);
    if (result.status === "saved") saved += 1;
    else if (result.status === "failed") failed += 1;
    else return { saved, failed, cancelled: true };
  }
  return { saved, failed, cancelled: false };
};
