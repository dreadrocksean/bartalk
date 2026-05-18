import { getApp, getApps } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import { getStorage } from "@react-native-firebase/storage";

export const getFirebaseApp = () => {
  const apps = getApps();

  if (apps.length > 0) {
    return apps[0];
  }

  return getApp();
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());

export const getFirebaseDb = () => getFirestore(getFirebaseApp());

export const getFirebaseStorage = (bucketUrl?: string) =>
  getStorage(getFirebaseApp(), bucketUrl);
