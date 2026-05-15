# BarTalk

BarTalk is an Expo Router app with Firebase auth, push notifications, Apple Sign-In, Google Sign-In, and messaging screens migrated onto a clean Expo managed project.

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
