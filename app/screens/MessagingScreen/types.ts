import type {
  MessageDoc,
  MessageMedia,
  MessageMediaType,
  ReplyReference,
} from "../../types/firestore";

export type ReplyTarget = Required<
  Pick<ReplyReference, "messageId" | "senderId" | "snippet">
> & {
  type: "text";
};

export type PendingMedia = {
  /** Stable key for lists and for removing one item from the tray. */
  id: string;
  source: "picker" | "paste";
  type: MessageMediaType;
  previewUri: string;
  localUri?: string;
  dataUri?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

/** What the full-screen viewer is showing, and where in the set it opened. */
export type MediaViewerState = {
  items: MessageMedia[];
  index: number;
};

export type MessageActionSheetState = {
  isMe: boolean;
  canEdit: boolean;
  message: MessageDoc;
};

export type MessageListItem =
  | {
      type: "dayHeader";
      id: string;
      label: string;
    }
  | {
      type: "message";
      id: string;
      message: MessageDoc;
    };

export type SwipeAutoCloseTimeoutsMap = Map<
  string,
  ReturnType<typeof setTimeout>
>;
