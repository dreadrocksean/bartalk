/**
 * Firebase Cloud Functions for BarTalk.
 */

import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";

import {admin, db} from "./admin";
import {getUserPushTarget, sendExpoPush} from "./push";

export {
  completeDependantReleases,
  createPairingCode,
  redeemPairingCode,
} from "./guardianship";
export {attachLinkPreview, requestLinkPreview} from "./link-preview";
export {onLocationWrite} from "./sharing-health";
export {
  onTrackingLinkWrite,
  onWatchSessionWrite,
  reapStaleWatchSessions,
} from "./tracking";

const ANDROID_NOTIFICATION_CHANNEL_ID = "messages";

export const sendPushNotification = runWith({maxInstances: 10})
  .firestore
  .document("conversations/{conversationId}/messages/{messageId}")
  .onCreate(
    async (
      snap: functions.firestore.DocumentSnapshot,
      context: functions.EventContext,
    ) => {
      const message = snap.data();
      if (!message) {
        functions.logger.warn("Message document is empty", {
          conversationId: context.params.conversationId,
          messageId: context.params.messageId,
        });
        return null;
      }

      const receiverId = message.receiverId;
      if (typeof receiverId !== "string" || receiverId.trim().length === 0) {
        functions.logger.warn("Message missing valid receiverId", {
          conversationId: context.params.conversationId,
          messageId: context.params.messageId,
        });
        return null;
      }
      const normalizedReceiverId = receiverId.trim();
      const senderId =
        typeof message.sender === "string" ? message.sender.trim() : "";
      if (senderId.length === 0) {
        functions.logger.warn("Message missing valid sender", {
          conversationId: context.params.conversationId,
          messageId: context.params.messageId,
        });
        return null;
      }
      if (senderId === normalizedReceiverId) {
        functions.logger.info(
          "Skipping push because sender and receiver are the same user",
          {
            senderId,
            receiverId: normalizedReceiverId,
            messageId: context.params.messageId,
          },
        );
        return null;
      }

      // The badge is counted here, before any of the reasons a push might not
      // be sent. A receiver with no push token, or one whose device matches the
      // sender's, still has an unread message — bailing out below must not cost
      // them the count. Reset to zero when they open the conversation.
      try {
        await db
          .collection("conversations")
          .doc(context.params.conversationId as string)
          .set(
            {
              unreadCounts: {
                [normalizedReceiverId]: admin.firestore.FieldValue.increment(1),
              },
            },
            {merge: true},
          );
      } catch (error) {
        // A failed count must never swallow the notification itself.
        functions.logger.error("Failed to increment unread count", {
          conversationId: context.params.conversationId,
          receiverId: normalizedReceiverId,
          error,
        });
      }

      const target = await getUserPushTarget(normalizedReceiverId);
      if (!target) {
        functions.logger.info("No server-side push token found for receiver", {
          receiverId: normalizedReceiverId,
          messageId: context.params.messageId,
        });
        return null;
      }
      const senderPushToken =
        typeof message.senderPushToken === "string" ?
          message.senderPushToken :
          null;
      if (senderPushToken && senderPushToken === target.token) {
        functions.logger.info(
          "Skipping push because receiver token matches sender device token",
          {
            senderId,
            receiverId: normalizedReceiverId,
            messageId: context.params.messageId,
          },
        );
        return null;
      }

      // `media` is the current shape; `image` is what senders on older builds
      // still write, so a message may carry either.
      const media: {type?: string; url?: string}[] =
        Array.isArray(message.media) ?
          message.media.filter((item: {url?: string}) => Boolean(item?.url)) :
          message.image?.url ?
            [{type: "image", url: message.image.url}] :
            [];
      const hasMedia = media.length > 0;
      const videoCount =
        media.filter((item) => item.type === "video").length;
      const mediaGlyph = hasMedia && videoCount === media.length ? "🎥" : "📷";
      const mediaLabel =
        media.length > 1 ?
          videoCount === media.length ?
            `${media.length} videos` :
            videoCount === 0 ?
              `${media.length} photos` :
              `${media.length} attachments` :
          videoCount === 1 ? "Video" : "Photo";
      const text =
        typeof message.text === "string" ? message.text.trim() : "";
      const resolvedKind =
        typeof message.kind === "string" ? message.kind :
          hasMedia && text.length > 0 ? "mixed" :
            media.length > 1 ? "album" :
              videoCount === 1 ? "video" :
                hasMedia ? "image" :
                  "text";
      const defaultBody =
        hasMedia ? `${mediaGlyph} ${mediaLabel}` : "You have a new message";
      const rawBody =
        text.length > 0 ?
          hasMedia ? `${mediaGlyph} ${text}` : text :
          defaultBody;
      const body =
        rawBody.length > 100 ? `${rawBody.slice(0, 97)}...` : rawBody;
      const replyToMessageId =
        typeof message.replyTo?.messageId === "string" ?
          message.replyTo.messageId :
          null;
      const payloadData: Record<string, string> = {
        conversationId: context.params.conversationId,
        senderId,
        receiverId: normalizedReceiverId,
        messageId: context.params.messageId,
        messageKind: resolvedKind,
      };
      if (replyToMessageId) {
        payloadData.replyToMessageId = replyToMessageId;
      }

      await sendExpoPush(
        {
          to: target.token,
          sound: "default",
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
          title: replyToMessageId ?
            "New reply" :
            hasMedia ?
              media.length > 1 ?
                videoCount === media.length ? "New videos" : "New photos" :
                videoCount === 1 ? "New video" : "New photo" :
              "New message",
          body,
          data: payloadData,
        },
        {
          receiverId: normalizedReceiverId,
          messageId: context.params.messageId,
        },
      );

      return null;
    },
  );
