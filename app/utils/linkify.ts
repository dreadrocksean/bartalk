// Finding the links inside a chat message.
//
// Deliberately conservative: explicit URLs, www-prefixed hosts, email
// addresses and phone numbers. Bare domains are left alone, because the rule
// that turns "example.com" into a link also turns "node.js" and "React.memo"
// into one, and a message full of accidental links is worse than one where a
// domain has to be typed with its scheme.

export type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const URL_PATTERN = "(?:https?:\\/\\/|www\\.)[^\\s<>\"']+";
const EMAIL_PATTERN = "[\\w.!#$%&'*+/=?^`{|}~-]+@[\\w-]+(?:\\.[\\w-]+)+";
/** Seven digits or more, allowing the usual separators and a leading +. */
const PHONE_PATTERN = "\\+?\\d[\\d\\s().-]{6,}\\d";

const MATCHER = new RegExp(
  `(${URL_PATTERN})|(${EMAIL_PATTERN})|(${PHONE_PATTERN})`,
  "gi",
);

/**
 * Punctuation that ends a sentence rather than the URL inside it, so
 * "see https://example.com/a." links to the page and not to "a.".
 * Brackets are only trimmed when they are unbalanced, which keeps the closing
 * parenthesis of a Wikipedia-style path.
 */
const trimTrailingPunctuation = (raw: string) => {
  let value = raw;
  while (value.length > 1) {
    const last = value[value.length - 1];
    if (".,;:!?'\"".includes(last)) {
      value = value.slice(0, -1);
      continue;
    }
    if (last === ")" || last === "]" || last === "}") {
      const open = last === ")" ? "(" : last === "]" ? "[" : "{";
      const opens = value.split(open).length - 1;
      const closes = value.split(last).length - 1;
      if (closes > opens) {
        value = value.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return value;
};

const hrefFor = (value: string, kind: "url" | "email" | "phone") => {
  if (kind === "email") return `mailto:${value}`;
  if (kind === "phone") return `tel:${value.replace(/[^\d+]/g, "")}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

/**
 * Splits a message into plain runs and link runs, in order. A message with no
 * links comes back as a single text part.
 */
export const splitIntoLinkParts = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let lastIndex = 0;

  MATCHER.lastIndex = 0;
  let match = MATCHER.exec(text);
  while (match) {
    const [raw, url, email] = match;
    const kind: "url" | "email" | "phone" = url
      ? "url"
      : email
        ? "email"
        : "phone";
    const value = kind === "phone" ? raw.trim() : trimTrailingPunctuation(raw);

    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "link", value, href: hrefFor(value, kind) });

    lastIndex = match.index + value.length;
    // The trimmed punctuation has to be reconsidered as ordinary text.
    MATCHER.lastIndex = lastIndex;
    match = MATCHER.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
};

/** Whether a message contains anything worth rendering as a link. */
export const hasLink = (text: string) =>
  splitIntoLinkParts(text).some((part) => part.type === "link");
