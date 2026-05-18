/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// iMessage gray and BarTalk gold accent
const iMessageBlue = "#007AFF";
const iMessageGray = "#e5e5ea";
const iMessageDarkBlue = "#0a2540";
const barTalkBubbleBottom = "#ecd0a6";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#222",
    background: iMessageGray,
    tint: iMessageBlue,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: iMessageBlue,
    bubbleMe: barTalkBubbleBottom,
    bubbleOther: "#fff",
    bubbleTextMe: "#2F1D10",
    bubbleTextOther: "#222",
    inputBar: "#f9f9f9",
    border: iMessageGray,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    bubbleMe: iMessageDarkBlue,
    bubbleOther: "#222",
    bubbleTextMe: "#fff",
    bubbleTextOther: "#ECEDEE",
    inputBar: "#222",
    border: "#333",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
