# BarTalk

BarTalk is an Expo Router app with Firebase auth, push notifications, Apple
Sign-In, Google Sign-In, messaging, and consent-based device tracking.

The app has two tabs: **Chat** and **Track**.

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Create a local env file from `.env.example` and fill in the Google OAuth client IDs.

3. Start Metro:

```bash
yarn start
```

4. Install the development build on your device and open the app from the dev client.

## Device tracking

Location sharing is opt-in per person and, unusually, symmetrical: **the trackee
is notified every time a tracker checks where they are**, by name, in real time,
with a permanent record in their "who checked on me" list. That is the point of
the feature, not a courtesy on top of it — so it is enforced in
`firestore.rules`, not just in the UI. A tracker can only read a position while a
watch session document exists, and creating that document is what triggers the
notification. There is no path to a position that skips the alert.

How it fits together:

- `tracking-api.ts` — Firestore reads and writes.
- `tracking/` — the provider that owns watch sessions, the background location
  task, and shared constants (all the tuning lives in `tracking/constants.ts`).
- `app/screens/TrackeesScreen/` — the Track tab: requests, who I can see, who can
  see me, and the history of checks.
- `app/screens/TrackingScreen/` — the map, reached only by an explicit **Track**
  button so that every person on it was added by a deliberate, notifying act.
- `functions/src/tracking.ts` — sends the notification and writes the audit log.

### Google Maps key (Android only)

iOS renders with Apple Maps and needs no key. Android needs a Google Maps SDK key
restricted to `com.dreadrocksoftware.bartalk`:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=
```

It is read in `app.config.ts` (not `app.json`, which cannot interpolate env
vars). Without it, Android shows a blank map.

### Native rebuild required

`react-native-maps`, `expo-location`, `expo-task-manager` and `expo-updates` are
native modules. After pulling these changes:

```bash
npx expo prebuild -p ios   # regenerates the committed ios/ project
npx expo run:ios
```

The existing dev client will not work until it is rebuilt.

### Firestore rules

`firestore.rules` and `firestore.indexes.json` are new to this repo — rules were
previously managed in the Firebase console. **Review them against what is live
before deploying**, then:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

The `reapStaleWatchSessions` function is scheduled, so deploying functions will
prompt to enable Cloud Scheduler.

To check the rules before deploying:

```bash
yarn verify-rules
```

That runs `scripts/verify-tracking-rules.mjs` against the Firestore emulator and
asserts the guarantees the feature depends on — most importantly that an
approved tracker still cannot read a position until a watch session exists.
The Firestore emulator needs JDK 21 or newer. If `java -version` reports
something older, point `JAVA_HOME` at a newer one for the command only — on a
Homebrew machine where `openjdk@21` is installed keg-only (so `java_home`
doesn't list it):

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  yarn verify-rules
```

### Store review

Background location needs a Play Console **Location permissions** declaration
(one named feature, a prominent in-app disclosure, a demo video and a live
privacy-policy URL) and clear iOS purpose strings. Both gate release, so start
them early.

## Over-the-air updates

JS-only changes ship without a store review:

```bash
yarn update-preview      # eas update --branch preview
yarn update-production   # eas update --branch production
```

`runtimeVersion` uses the `fingerprint` policy, so an update built against
different native dependencies is never delivered to an incompatible binary.

**Needs a new build:** anything native — adding or upgrading a native module,
changing `app.json`/`app.config.ts` plugins, permissions, icons or the splash
screen. **Can go OTA:** screens, styling, copy, constants and business logic.

## Google Sign-In

Google Sign-In requires these env vars in the project root:

```bash
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Use the OAuth client IDs from your Google Cloud or Firebase project.

## iOS Development Build

Build a dev client with:

```bash
eas build --profile development --platform ios
```

This app cannot use Expo Go for Apple Sign-In, Google Sign-In, or push notifications.

## Scripts

```bash
yarn start
yarn ios
yarn android
yarn web
yarn build-ios
yarn build-android
```
