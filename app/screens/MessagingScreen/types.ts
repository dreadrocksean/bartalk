import type { MessageDoc, ReplyReference } from "../../types/firestore";

export type ReplyTarget = Required<
  Pick<ReplyReference, "messageId" | "senderId" | "snippet">
> & {
  type: "text";
};

export type PendingImage = {
  source: "picker" | "paste";
  previewUri: string;
  localUri?: string;
  dataUri?: string;
  width?: number;
  height?: number;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
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
