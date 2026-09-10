import * as admin from "firebase-admin";

// Initialised here rather than in index.ts so any module can import the
// Firestore handle without depending on import order.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.firestore();
export {admin};
