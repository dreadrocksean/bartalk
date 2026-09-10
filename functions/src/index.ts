/**
 * Firebase Cloud Functions for BarTalk.
 */

import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";

import {getUserPushTarget, sendExpoPush} from "./push";

export {onWatchSessionWrite, reapStaleWatchSessions} from "./tracking";

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

      const hasImage = Boolean(message.image?.url);
      const text =
        typeof message.text === "string" ? message.text.trim() : "";
      const resolvedKind =
        typeof message.kind === "string" ? message.kind :
          hasImage && text.length > 0 ? "mixed" :
            hasImage ? "image" :
              "text";
      const defaultBody = hasImage ? "📷 Photo" : "You have a new message";
      const rawBody =
        text.length > 0 ? hasImage ? `📷 ${text}` : text : defaultBody;
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
            hasImage ?
              "New photo" :
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
