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
