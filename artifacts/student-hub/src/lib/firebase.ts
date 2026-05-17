import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  Firestore,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;
let db: Firestore;
let storage: FirebaseStorage;

if (isConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.addScope("email");
  googleProvider.addScope("profile");

  // Enable IndexedDB offline persistence — serves cached data INSTANTLY
  // on repeat visits while syncing from the network in the background.
  // Falls back to memory-only if the browser blocks IndexedDB (private mode, etc.)
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    db = getFirestore(app);
  }

  storage = getStorage(app);
} else {
  console.error("[Firebase] ❌ NOT CONFIGURED — missing env vars:", {
    apiKey:     !!firebaseConfig.apiKey,
    projectId:  !!firebaseConfig.projectId,
    authDomain: !!firebaseConfig.authDomain,
  });
  app = {} as FirebaseApp;
  auth = {
    onAuthStateChanged: (_cb: (u: null) => void) => { _cb(null); return () => {}; },
    currentUser: null,
  } as unknown as Auth;
  googleProvider = new GoogleAuthProvider();
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

export { app, auth, googleProvider, db, storage };
