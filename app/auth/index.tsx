import {
  AppleSignInButton,
  GoogleSignInButton,
} from "@/components/ui/social-signin-buttons";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  AppleAuthProvider,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import React, { useEffect, useState } from "react";
import { Alert, Button, Platform, Text, TextInput, View } from "react-native";
import { createUserProfile, updateUserExpoPushToken } from "../../api";
import { getFirebaseAuth } from "../../firebase";
import styles from "./styles";

type AuthScreenProps = {
  onAuthSuccess: () => void;
};

const createNonce = () => {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._";
  return Array.from({ length: 32 }, () => {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    return alphabet[randomIndex];
  }).join("");
};

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [phone, setPhone] = useState("");
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const isGoogleConfigured = Boolean(googleWebClientId || googleIosClientId);

  const { requestPushPermissionAndToken } = usePushNotifications();

  useEffect(() => {
    if (!isGoogleConfigured) {
      return;
    }

    GoogleSignin.configure({
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId,
    });
  }, [googleIosClientId, googleWebClientId, isGoogleConfigured]);

  const handleAuth = async () => {
    setLoading(true);
    try {
      let user;
      const auth = getFirebaseAuth();
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        user = userCredential.user;
        await createUserProfile(user.uid, {
          fname,
          lname,
          phone,
          email,
        });
      } else {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        user = userCredential.user;
        await createUserProfile(user.uid, {
          email: user.email || email,
          phone: user.phoneNumber || "",
        });
      }
      // Request notification permissions and get Expo push token
      const expoPushToken = await requestPushPermissionAndToken();
      // Save push token to user profile if available
      if (expoPushToken && user) {
        try {
          await updateUserExpoPushToken(user.uid, expoPushToken);
        } catch {}
      }
      onAuthSuccess();
    } catch (error) {
      let message = "Unknown error";
      if (typeof error === "object" && error && "message" in error) {
        message = (error as any).message;
      }
      Alert.alert("Auth Error", message);
    } finally {
      setLoading(false);
    }
  };

  // Placeholder handlers for social sign-in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      if (!isGoogleConfigured) {
        throw new Error(
          "Google Sign-In is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in Bartalk/.env.",
        );
      }

      const result = await GoogleSignin.signIn();
      if (result.type === "success") {
        const idToken = result.data.idToken;
        if (!idToken) {
          throw new Error(
            "Missing Google ID token. Confirm the Google OAuth client IDs in Bartalk/.env are correct.",
          );
        }
        const credential = GoogleAuthProvider.credential(idToken);
        const auth = getFirebaseAuth();
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;
        await createUserProfile(user.uid, {
          fname: result.data.user.givenName || "",
          lname: result.data.user.familyName || "",
          phone: user.phoneNumber || "",
          email: user.email || result.data.user.email || "",
        });
        const expoPushToken = await requestPushPermissionAndToken();
        if (expoPushToken && user) {
          try {
            await updateUserExpoPushToken(user.uid, expoPushToken);
          } catch {}
        }
        onAuthSuccess();
      } else {
        Alert.alert("Google Sign-In cancelled");
      }
    } catch (e: any) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Google Sign-In cancelled");
      } else {
        Alert.alert("Google Sign-In Error", e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const rawNonce = createNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("No Apple identity token");
      const firebaseCredential = AppleAuthProvider.credential(
        credential.identityToken,
        rawNonce,
      );
      const auth = getFirebaseAuth();
      const userCredential = await signInWithCredential(
        auth,
        firebaseCredential,
      );
      const user = userCredential.user;
      // Optionally create user profile in Firestore if new
      await createUserProfile(user.uid, {
        fname: credential.fullName?.givenName || "",
        lname: credential.fullName?.familyName || "",
        phone: user.phoneNumber || "",
        email: user.email || credential.email || "",
      });
      // Request notification permissions and save token
      const expoPushToken = await requestPushPermissionAndToken();
      if (expoPushToken && user) {
        try {
          await updateUserExpoPushToken(user.uid, expoPushToken);
        } catch {}
      }
      onAuthSuccess();
    } catch (e: any) {
      console.error("Apple Sign-In Error:", e);

      if (e.code === "ERR_CANCELED") {
        Alert.alert("Apple Sign-In cancelled");
      } else {
        const rawMessage = [e?.code, e?.message || String(e)]
          .filter(Boolean)
          .join("\n\n");
        Alert.alert("Apple Sign-In Error", rawMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isSignUp ? "Sign Up" : "Sign In"}</Text>
      <GoogleSignInButton
        onPress={handleGoogleSignIn}
        disabled={!isGoogleConfigured}
      />
      {!isGoogleConfigured ? (
        <Text style={styles.helperText}>
          Google Sign-In will be available after the OAuth client IDs are added
          to Bartalk/.env.
        </Text>
      ) : null}
      {Platform.OS === "ios" ? (
        <AppleSignInButton onPress={handleAppleSignIn} />
      ) : null}
      {isSignUp && (
        <>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            value={fname}
            onChangeText={setFname}
            placeholderTextColor="#d4d4d4"
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            value={lname}
            onChangeText={setLname}
            placeholderTextColor="#d4d4d4"
          />
          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#d4d4d4"
          />
        </>
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor="#d4d4d4"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#d4d4d4"
      />
      <Button
        title={isSignUp ? "Sign Up" : "Sign In"}
        onPress={handleAuth}
        disabled={loading}
      />
      <Text style={styles.switchText} onPress={() => setIsSignUp((v) => !v)}>
        {isSignUp
          ? "Already have an account? Sign In"
          : "Don't have an account? Sign Up"}
      </Text>
    </View>
  );
};

export default AuthScreen;
