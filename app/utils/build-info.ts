// The app's version and build number, as App Store Connect knows them.

import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * e.g. "Version 1.0.0 (10)".
 *
 * The build number comes from the platform manifest, not from
 * Constants.nativeBuildVersion — that is still declared in the types, so it
 * compiles cleanly, but the JS layer no longer populates it. It reads as
 * undefined at runtime and the build number silently vanishes from the label,
 * which is exactly how it shipped the first time.
 *
 * It is read from the binary rather than app.json on purpose: EAS increments
 * the build number remotely, so app.json never carries the number that is
 * actually installed.
 */
export const buildLabel = (): string => {
  const version = Constants.expoConfig?.version;
  const build =
    Platform.OS === "ios"
      ? Constants.platform?.ios?.buildNumber
      : Constants.platform?.android?.versionCode?.toString();

  if (!version) return build ? `Version (${build})` : "";
  return build ? `Version ${version} (${build})` : `Version ${version}`;
};
