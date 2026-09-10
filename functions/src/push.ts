/**
 * Shared Expo push delivery, used by both messaging and tracking.
 */

import * as functions from "firebase-functions/v1";

import {db} from "./admin";

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

export type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  sound?: string;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
  /**
   * iOS only. Wakes the app in the background to run a task. A message with
   * this set must carry no title, body or channelId, or the push service
   * turns it back into a visible notification.
   */
  contentAvailable?: boolean;
  data?: Record<string, string>;
};

export type UserPushTarget = {
  token: string;
  platform: "ios" | "android" | "unknown";
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const getPushTickets = (value: ExpoPushSendResponse): ExpoPushTicket[] => {
  if (!value.data) {
    return [];
  }
  return Array.isArray(value.data) ? value.data : [value.data];
};

export const getUserPushTarget = async (
  uid: string,
): Promise<UserPushTarget | null> => {
  const userSnap = await db.collection("Users").doc(uid).get();
  const data = userSnap.data();
  const token = data?.expoPushToken;
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }
  const platform = data?.expoPushPlatform;
  return {
    token,
    platform:
      platform === "ios" || platform === "android" ? platform : "unknown",
  };
};

/**
 * Returns true when Expo accepted every ticket. Failures are logged rather
 * than thrown: a push that doesn't land must never fail the write that
 * triggered it.
 *
 * @param {ExpoPushMessage} message The push payload to deliver.
 * @param {Record<string, unknown>} logContext Extra fields for log entries.
 * @return {Promise<boolean>} True when every ticket came back ok.
 */
export const sendExpoPush = async (
  message: ExpoPushMessage,
  logContext: Record<string, unknown> = {},
): Promise<boolean> => {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    const rawBody = await response.text();

    if (!response.ok) {
      functions.logger.error("Expo push request failed", {
        status: response.status,
        body: rawBody,
        ...logContext,
      });
      return false;
    }

    let jsonResponse: ExpoPushSendResponse;
    try {
      jsonResponse = JSON.parse(rawBody) as ExpoPushSendResponse;
    } catch {
      functions.logger.error("Expo push response was not valid JSON", {
        body: rawBody,
        ...logContext,
      });
      return false;
    }

    const tickets = getPushTickets(jsonResponse);
    const failedTickets = tickets.filter((ticket) => ticket.status !== "ok");

    if (failedTickets.length > 0 || (jsonResponse.errors?.length ?? 0) > 0) {
      functions.logger.error("Expo push returned ticket errors", {
        failedTickets,
        errors: jsonResponse.errors ?? [],
        ...logContext,
      });
      return false;
    }

    functions.logger.info("Expo push sent", {
      ticketCount: tickets.length,
      ticketIds: tickets.map((ticket) => ticket.id).filter(Boolean),
      ...logContext,
    });
    return true;
  } catch (error) {
    functions.logger.error("Expo push request threw an error", {
      error: error instanceof Error ? error.message : String(error),
      ...logContext,
    });
    return false;
  }
};
