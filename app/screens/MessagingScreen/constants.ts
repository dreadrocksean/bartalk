import { smartShade } from "@/app/utils/colorUtils";
import { Colors } from "../../../constants/theme";

export const TYPING_PAUSE_MS = 1500;
export const TYPING_STALE_MS = 5000;
export const MESSAGE_HIGHLIGHT_MS = 1800;
export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 120;
export const LOAD_OLDER_TOP_THRESHOLD_PX = 96;
export const LOAD_OLDER_THROTTLE_MS = 450;
export const MESSAGES_PAGE_SIZE = 30;
export const SWIPE_AUTO_CLOSE_MS = 100;
export const SWIPE_ANIMATION_OPTIONS = {
  speed: 14,
  bounciness: 6,
} as const;

/**
 * Kept in step with PREVIEW_VERSION in the backend. A card written by an older
 * build is asked for again the first time it is read, so a fix to how cards
 * are built reaches history without migrating anything.
 */
export const LINK_PREVIEW_VERSION = 2;

/** How many attachments one message may carry. */
export const MEDIA_SELECTION_LIMIT = 10;

/**
 * The fanned stack shows the newest attachment face-on with two more peeking
 * out behind it, so the shape reads as "several" before the count is read.
 */
export const MEDIA_STACK_VISIBLE_LAYERS = 3;
export const MEDIA_STACK_LAYER_ROTATION_DEG = 4.5;
export const MEDIA_STACK_LAYER_OFFSET_PX = 5;
export const MEDIA_STACK_LAYER_SCALE_STEP = 0.045;

const MY_BUBBLE_COLOR = Colors.light.bubbleMe;
export const MY_BUBBLE_GRADIENT_COLORS = [
  smartShade(MY_BUBBLE_COLOR, -5),
  MY_BUBBLE_COLOR,
] as const;

export const QUICK_REPLY_EMOJIS = [
  "❤️",
  "👍",
  "👎",
  "😂",
  "🔥",
  "😮",
  "??",
  "🙏",
  "😍",
  "👏",
  "😭",
  "🙌",
  "🤔",
  "😅",
  "🎉",
  "✅",
  "👀",
  "💯",
  "🤝",
  "😎",
] as const;

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tues",
  "Wed",
  "Thurs",
  "Fri",
  "Sat",
] as const;

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
