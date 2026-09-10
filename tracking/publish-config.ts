// A snapshot of what the trackee's device should publish, persisted so the
// background location task can read it. Background tasks run in a headless JS
// context with no React state and no mounted providers, so anything the task
// needs has to be on disk before the task fires.

import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  LocationPermissionState,
  LocationPublishMode,
} from "../app/types/tracking";

const CONFIG_KEY = "bartalk.tracking.publishConfig";
const PENDING_FIX_KEY = "bartalk.tracking.pendingFix";

export type PublishConfig = {
  userId: string;
  /** Tracker ids currently allowed to see this device. */
  sharedWith: string[];
  permissionState: LocationPermissionState;
  mode: LocationPublishMode;
};

export type PendingFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  capturedAt: number;
};

export const savePublishConfig = async (config: PublishConfig) => {
  try {
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // A failed cache write only costs us background precision, never correctness.
  }
};

export const loadPublishConfig = async (): Promise<PublishConfig | null> => {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublishConfig;
    if (!parsed?.userId || !Array.isArray(parsed.sharedWith)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearPublishConfig = async () => {
  try {
    await AsyncStorage.multiRemove([CONFIG_KEY, PENDING_FIX_KEY]);
  } catch {
    // ignore
  }
};

/**
 * Background Firestore writes can stall (see the RNFirebase headless-JS
 * caveat), so a fix that didn't make it is kept here and flushed the next time
 * the app is in the foreground with a real network window.
 */
export const savePendingFix = async (fix: PendingFix) => {
  try {
    await AsyncStorage.setItem(PENDING_FIX_KEY, JSON.stringify(fix));
  } catch {
    // ignore
  }
};

export const takePendingFix = async (): Promise<PendingFix | null> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_FIX_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_FIX_KEY);
    return JSON.parse(raw) as PendingFix;
  } catch {
    return null;
  }
};
