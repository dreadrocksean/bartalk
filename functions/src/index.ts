/**
 * Firebase Cloud Function for sending Expo push notifications on new messages.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import {runWith} from "firebase-functions/v1";

admin.initializeApp();
const db = admin.firestore();

type ExpoPushTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: unknown;
};

type ExpoPushSendResponse = {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: unknown[];
};

const ANDROID_NOTIFICATION_CHANNEL_ID = "messages";

const getPushTickets = (value: ExpoPushSendResponse): ExpoPushTicket[] => {
  if (!value.data) {
    return [];
  }
  return Array.isArray(value.data) ? value.data : [value.data];
};

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

      const userSnap = await db.collection("Users").doc(receiverId).get();
      const expoPushToken = userSnap.data()?.expoPushToken;
      if (typeof expoPushToken !== "string" || expoPushToken.length === 0) {
        functions.logger.info("No server-side push token found for receiver", {
          receiverId,
          messageId: context.params.messageId,
        });
        return null;
      }

      const text = String(message.text || "You have a new message");
      const body = text.length > 100 ? `${text.slice(0, 97)}...` : text;
      const payload = {
        to: expoPushToken,
        sound: "default",
        channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
        title: "New message",
        body,
        data: {
          conversationId: context.params.conversationId,
          senderId: message.sender,
          receiverId,
          messageId: context.params.messageId,
        },
      };

      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const rawBody = await response.text();

        if (!response.ok) {
          functions.logger.error("Expo push request failed", {
            status: response.status,
            body: rawBody,
            receiverId,
          });
          return null;
        }

        let jsonResponse: ExpoPushSendResponse;
        try {
          jsonResponse = JSON.parse(rawBody) as ExpoPushSendResponse;
        } catch {
          functions.logger.error("Expo push response was not valid JSON", {
            body: rawBody,
            receiverId,
          });
          return null;
        }

        const tickets = getPushTickets(jsonResponse);
        const failedTickets = tickets.filter(
          (ticket) => ticket.status !== "ok",
        );

        if (
          failedTickets.length > 0 ||
          (jsonResponse.errors?.length ?? 0) > 0
        ) {
          functions.logger.error("Expo push returned ticket errors", {
            receiverId,
            failedTickets,
            errors: jsonResponse.errors ?? [],
          });
          return null;
        }

        functions.logger.info("Expo push sent", {
          receiverId,
          ticketCount: tickets.length,
          ticketIds: tickets.map((ticket) => ticket.id).filter(Boolean),
        });
      } catch (error) {
        functions.logger.error("Expo push request threw an error", {
          receiverId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return null;
    },
  );
