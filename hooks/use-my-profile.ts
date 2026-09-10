// The signed-in user's own display name, used wherever the app has to tell
// someone else who did something — most importantly the "X is checking your
// location" notification, which is worthless without a real name attached.

import { doc, onSnapshot } from "@react-native-firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseDb } from "../firebase";

export const useMyProfile = (userId: string | null, fallbackName?: string) => {
  const [name, setName] = useState(fallbackName ?? "");

  useEffect(() => {
    if (!userId) {
      setName("");
      return;
    }

    return onSnapshot(doc(getFirebaseDb(), "Users", userId), (snapshot) => {
      const data = snapshot.data() ?? {};
      const fullName = `${data.fname ?? ""} ${data.lname ?? ""}`.trim();
      setName(fullName || fallbackName || "Someone");
    });
  }, [fallbackName, userId]);

  return name;
};
