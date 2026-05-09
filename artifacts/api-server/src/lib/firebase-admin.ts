import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let db: Firestore | null = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (getApps().length > 0) {
    try { db = getFirestore(); } catch {}
    return;
  }

  if (!serviceAccountJson) {
    console.warn("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_JSON not set — Admin Firestore unavailable. Set this secret to enable backend study saves.");
    return;
  }

  let app: App | undefined;

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    app = initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore(app);
    console.log("[Firebase Admin] Initialized with service account ✅");
  } catch (err) {
    console.error("[Firebase Admin] Init failed:", err);
  }
}

init();

export function getAdminDb(): Firestore | null {
  return db;
}

export function isAdminAvailable(): boolean {
  return db !== null;
}
