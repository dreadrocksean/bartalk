import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json with values that have to come from the environment.
 *
 * app.json is static, so `process.env` inside it is never interpolated — the
 * literal string would ship. Anything key-shaped therefore lives here.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      // Android renders the map with the Google Maps SDK, which needs a key
      // restricted to this package name. iOS uses Apple Maps and needs none.
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? "",
      },
    },
  },
});
