import type { MessageDoc } from "../../types/firestore";
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
