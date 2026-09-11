// The app's version and build number, as App Store Connect knows them.

import Constants from "expo-constants";

/** e.g. "Version 1.0.0 (10)". */
export const buildLabel = (): string => {
  const version = Constants.expoConfig?.version;
  const build = Constants.nativeBuildVersion;
  if (!version) return build ? `Version (${build})` : "";
  return build ? `Version ${version} (${build})` : `Version ${version}`;
};
