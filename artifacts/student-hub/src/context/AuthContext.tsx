import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  UserCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db, isConfigured } from "@/lib/firebase";

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  grade: number;
  role: "user" | "admin";
  createdAt: string;
}

type ProfileResult =
  | { status: "found"; profile: UserProfile }
  | { status: "not_found" }
  | { status: "error"; code: string };

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Firestore profile fetch ──────────────────────────────────────────────────

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    console.log("[Auth] Firestore READ — checking users/" + uid);
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Firestore READ — document does NOT exist (new user)");
      return { status: "not_found" };
    }
    const d = snap.data();
    const profile: UserProfile = {
      id: 0,
      uid: d.uid ?? uid,
      name: d.name ?? "",
      email: d.email ?? "",
      grade: d.grade ?? 0,
      role: d.role === "admin" ? "admin" : "user",
      createdAt: typeof d.createdAt === "string" ? d.createdAt : new Date().toISOString(),
    };
    console.log("[Auth] Firestore READ — profile found:", profile.name, "grade:", profile.grade, "role:", profile.role);
    return { status: "found", profile };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "unknown";
    console.error("[Auth] Firestore READ ERROR — code:", code, err);
    return { status: "error", code };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

function handleAuthRoute(status: "found" | "not_found" | "error") {
  const path = window.location.pathname;
  console.log("[Auth] ROUTE CHANGE — current path:", path, "| profile status:", status);

  if (status === "found") {
    if (path === "/" || path === "/login") {
      console.log("[Auth] ROUTE CHANGE — existing user → /dashboard");
      window.location.replace("/dashboard");
    }
  } else {
    // not_found or error — send to setup if on an auth/root page
    if (path !== "/setup-profile" && path !== "/onboarding") {
      console.log("[Auth] ROUTE CHANGE — new/unknown user → /setup-profile");
      window.location.replace("/setup-profile");
    } else {
      console.log("[Auth] ROUTE CHANGE — already on setup-profile, staying");
    }
  }
}

// Paths that unauthenticated users can access without being sent to /
const PUBLIC_PATH_REGEX =
  /^\/?$|^\/login|^\/notes|^\/pyqs|^\/pyq|^\/about|^\/contact|^\/ai|^\/report|^\/todo|^\/pomodoro|^\/leaderboard|^\/admin/;

// ─── Auth Provider ────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!isConfigured) {
      console.error("[Auth] ❌ Firebase not configured — auth disabled");
      setLoading(false);
      return;
    }

    console.log("[Auth] Initialising auth listener…");

    // ── Check for redirect-based sign-in result ──────────────────────────────
    // If user came back from signInWithRedirect, getRedirectResult resolves first.
    getRedirectResult(auth)
      .then((result: UserCredential | null) => {
        if (result?.user) {
          console.log("[Auth] REDIRECT RESULT:", result.user.email);
        } else {
          console.log("[Auth] REDIRECT RESULT: no pending redirect");
        }
      })
      .catch((err: unknown) => {
        const code = (err as { code?: string })?.code ?? "unknown";
        console.error("[Auth] REDIRECT RESULT error:", code, err);
      });

    // ── Main auth state listener ─────────────────────────────────────────────
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      console.log("[Auth] AUTH STATE:", firebaseUser ? firebaseUser.email : null);

      if (!firebaseUser) {
        setUser(null);
        setProfileState(null);
        setLoading(false);
        const path = window.location.pathname;
        console.log("[Auth] ROUTE CHANGE — no user, path:", path);
        if (!PUBLIC_PATH_REGEX.test(path)) {
          console.log("[Auth] ROUTE CHANGE — protected path, redirecting to /");
          window.location.replace("/");
        } else {
          console.log("[Auth] ROUTE CHANGE — public path, staying at", path);
        }
        return;
      }

      // User is signed in
      console.log("[Auth] AUTH STATE: signed in uid=" + firebaseUser.uid + " email=" + firebaseUser.email);
      setUser(firebaseUser);

      // Check Firestore
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      console.log("[Auth] PROFILE STATUS:", result.status);

      if (result.status === "found") {
        setProfileState(result.profile);
        setLoading(false);
        handleAuthRoute("found");
      } else if (result.status === "not_found") {
        setProfileState(null);
        setLoading(false);
        handleAuthRoute("not_found");
      } else {
        // Firestore error — don't assume profile exists; route to setup-profile
        console.warn("[Auth] Firestore error — code:", result.code, "— routing to setup-profile for safety");
        setProfileState(null);
        setLoading(false);
        handleAuthRoute("error");
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    console.log("[Auth] refreshProfile — uid:", currentUser.uid);
    const result = await fetchProfile(currentUser.uid);
    if (result.status === "found") setProfileState(result.profile);
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  // ── Sign in with Google ────────────────────────────────────────────────────

  const signInWithGoogle = async () => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Set VITE_FIREBASE_* environment variables.");
    }

    setLoading(true);
    console.log("[Auth] signInWithGoogle — attempting popup…");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log("[Auth] LOGIN RESULT:", result.user.email, "uid:", result.user.uid);
      // onAuthStateChanged handles redirect from here
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "unknown";
      console.warn("[Auth] signInWithPopup error — code:", code);

      // Popup was blocked or closed — fall back to redirect flow
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        if (code === "auth/popup-blocked") {
          console.log("[Auth] Popup was blocked — falling back to signInWithRedirect…");
          try {
            await signInWithRedirect(auth, googleProvider);
            // Page will redirect away; onAuthStateChanged fires when it returns
            return;
          } catch (redirectErr: unknown) {
            const rCode = (redirectErr as { code?: string })?.code ?? "unknown";
            console.error("[Auth] signInWithRedirect also failed — code:", rCode, redirectErr);
          }
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      throw err;
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────

  const signOut = async () => {
    console.log("[Auth] Signing out…");
    await firebaseSignOut(auth);
    setUser(null);
    setProfileState(null);
    setLoading(false);
    console.log("[Auth] ROUTE CHANGE — signed out → /");
    window.location.replace("/");
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
