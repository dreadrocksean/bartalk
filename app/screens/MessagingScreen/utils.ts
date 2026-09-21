import type { MessageDoc, MessageMedia } from "../../types/firestore";
import { MONTH_LABELS, WEEKDAY_LABELS } from "./constants";
import type { MessageListItem } from "./types";

export const mergeMessagesChronologically = (
  current: MessageDoc[],
  incoming: MessageDoc[],
) => {
  const mergedById = new Map<string, MessageDoc>();
  current.forEach((message) => {
    mergedById.set(message.id, message);
  });
  incoming.forEach((message) => {
    mergedById.set(message.id, message);
  });
  return Array.from(mergedById.values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
};

export const formatMessageTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getOrdinalDay = (dayNumber: number) => {
  const mod100 = dayNumber % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${dayNumber}th`;
  }
  switch (dayNumber % 10) {
    case 1:
      return `${dayNumber}st`;
    case 2:
      return `${dayNumber}nd`;
    case 3:
      return `${dayNumber}rd`;
    default:
      return `${dayNumber}th`;
  }
};

export const getDayHeaderLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const weekday = WEEKDAY_LABELS[date.getDay()];
  const day = getOrdinalDay(date.getDate());
  const month = MONTH_LABELS[date.getMonth()];
  return `${weekday} ${day} ${month}`;
};

export const buildMessageListItems = (messages: MessageDoc[]) => {
  const items: MessageListItem[] = [];
  let lastDayKey: string | null = null;

  messages.forEach((message) => {
    const messageDate = new Date(message.timestamp);
    const dayKey = `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;

    if (dayKey !== lastDayKey) {
      items.push({
        type: "dayHeader",
        id: `day-${dayKey}`,
        label: getDayHeaderLabel(message.timestamp),
      });
      lastDayKey = dayKey;
    }

    items.push({
      type: "message",
      id: message.id,
      message,
    });
  });

  return items;
};

/**
 * Every attachment on a message, whichever shape it was written in. Messages
 * sent before multi-attachment support only have the single `image` field, so
 * they are lifted into the same array the rest of the UI works with.
 */
export const getMessageMedia = (message: MessageDoc): MessageMedia[] => {
  const media = Array.isArray(message.media) ? message.media : [];
  const usable = media.filter((item) => Boolean(item?.url));
  if (usable.length > 0) {
    return usable.map((item) => ({
      ...item,
      type: item.type === "video" ? "video" : "image",
    }));
  }
  if (message.image?.url) {
    return [{ ...message.image, type: "image" }];
  }
  return [];
};

/** "0:07", "1:42", "12:05" — the shape a duration takes on a video tile. */
export const formatMediaDuration = (durationMs?: number) => {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return "";
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/** What a message reads as when it is quoted in a reply or a notification. */
export const describeMessageMedia = (media: MessageMedia[]) => {
  if (media.length === 0) return "";
  if (media.length > 1) {
    const allVideos = media.every((item) => item.type === "video");
    const allImages = media.every((item) => item.type === "image");
    if (allVideos) return `${media.length} videos`;
    if (allImages) return `${media.length} photos`;
    return `${media.length} attachments`;
  }
  return media[0].type === "video" ? "Video" : "Photo";
};
