// What this copy of the app actually is.
//
// Two different questions, and today they have different answers: which binary
// you installed, and which JavaScript it is running. An over-the-air update
// changes the second without touching the first, so "1.0.0 (9)" alone cannot
// tell you whether a fix has actually arrived on a device — which is exactly
// the thing anyone reading this screen is usually trying to find out.

import Constants from "expo-constants";
import * as Updates from "expo-updates";

/** The binary: version and build number, as App Store Connect knows them. */
export const buildLabel = (): string => {
  const version =
    Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version;
  const build = Constants.nativeBuildVersion;
  if (!version) return "BarTalk";
  return build ? `BarTalk ${version} (${build})` : `BarTalk ${version}`;
};

/** The JavaScript: embedded with the binary, or downloaded over the air. */
export const updateLabel = (): string => {
  if (__DEV__) return "development build";

  const channel = Updates.channel ?? "no channel";

  if (Updates.isEmbeddedLaunch || !Updates.updateId) {
    return `${channel} · bundled with this build`;
  }

  // Eight characters is enough to match against a published update without
  // making this line unreadable.
  const id = Updates.updateId.replace(/-/g, "").slice(0, 8);
  const when = Updates.createdAt
    ? Updates.createdAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;
  return when
    ? `${channel} · update ${id} · ${when}`
    : `${channel} · update ${id}`;
};
