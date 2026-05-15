import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

let db: Firestore | null = null;
let adminStorage: Storage | null = null;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET;

  if (getApps().length > 0) {
    try { db = getFirestore(); } catch {}
    try { adminStorage = getStorage(); } catch {}
    return;
  }

  if (!serviceAccountJson) {
    console.warn("[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_JSON not set — Admin Firestore unavailable. Set this secret to enable backend study saves.");
    return;
  }

  let app: App | undefined;

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const appConfig: Parameters<typeof initializeApp>[0] = { credential: cert(serviceAccount) };
    if (storageBucket) appConfig.storageBucket = storageBucket;
    app = initializeApp(appConfig);
    db = getFirestore(app);
    adminStorage = getStorage(app);
    console.log("[Firebase Admin] Initialized with service account ✅");
  } catch (err) {
    console.error("[Firebase Admin] Init failed:", err);
  }
}

init();

export function getAdminDb(): Firestore | null {
  return db;
}

export function getAdminStorage(): Storage | null {
  return adminStorage;
}

export function isAdminAvailable(): boolean {
  return db !== null;
}
