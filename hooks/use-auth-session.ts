// The signed-in user, resolved once for the whole app. Lives above the tab
// navigator so an unauthenticated user never renders a tab bar around the
// sign-in screen.

import {
  onAuthStateChanged,
  type FirebaseAuthTypes,
} from "@react-native-firebase/auth";
import { useEffect, useState } from "react";

import { getFirebaseAuth } from "../firebase";

export const useAuthSession = () => {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, isLoading, setUser };
};
