import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length > 0) return;

  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.VITE_FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson) as object;
      initializeApp({ credential: cert(serviceAccount) });
      return;
    } catch {
      console.error("[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON — falling back");
    }
  }

  if (projectId) {
    initializeApp({ projectId });
    return;
  }

  initializeApp();
}

initAdmin();

export const adminDb = getFirestore();
