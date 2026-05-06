import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  signOut as firebaseSignOut,
  UserCredential,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db, isConfigured } from "@/lib/firebase";
import { getPendingProfile, clearPendingProfile } from "@/pages/Onboarding";

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

export type SignInOutcome = "success" | "cancelled" | "redirect";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ outcome: SignInOutcome; isNewUser: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Firestore profile fetch ──────────────────────────────────────────────────

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    console.log("[Auth] Firestore READ — users/" + uid);
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Firestore READ — no document (new user)");
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
    console.log("[Auth] Firestore READ — found:", profile.name, "grade:", profile.grade);
    return { status: "found", profile };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "unknown";
    console.error("[Auth] Firestore READ error:", code, err);
    return { status: "error", code };
  }
}

// ─── Routing helper ───────────────────────────────────────────────────────────

// Paths unauthenticated users may visit (SoftGate overlay handles them)
const PUBLIC_PATH_REGEX =
  /^\/?$|^\/login|^\/notes|^\/pyqs|^\/pyq|^\/about|^\/contact|^\/ai|^\/report|^\/todo|^\/pomodoro|^\/leaderboard|^\/admin/;

// ─── Provider ─────────────────────────────────────────────────────────────────

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

    // Handle any pending redirect sign-in (popup-blocked fallback)
    getRedirectResult(auth)
      .then((result: UserCredential | null) => {
        if (result?.user) {
          console.log("[Auth] REDIRECT RESULT:", result.user.email);
        } else {
          console.log("[Auth] REDIRECT RESULT: none pending");
        }
      })
      .catch((err: unknown) => {
        console.error("[Auth] REDIRECT RESULT error:", (err as { code?: string })?.code, err);
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      console.log("[Auth] AUTH STATE:", firebaseUser ? firebaseUser.email : null);

      // ── No user ──────────────────────────────────────────────────────────
      if (!firebaseUser) {
        setUser(null);
        setProfileState(null);
        setLoading(false);
        const path = window.location.pathname;
        console.log("[Auth] ROUTE: no user, path:", path);
        if (!PUBLIC_PATH_REGEX.test(path)) {
          console.log("[Auth] ROUTE: protected path → /");
          window.location.replace("/");
        }
        return;
      }

      // ── User signed in ────────────────────────────────────────────────────
      console.log("[Auth] AUTH STATE: uid=" + firebaseUser.uid);
      setUser(firebaseUser);

      // Check sessionStorage for a profile that was saved optimistically
      // (written by Onboarding before the Firestore round-trip completed)
      const pending = getPendingProfile(firebaseUser.uid);
      if (pending) {
        console.log("[Auth] Using pending profile from sessionStorage — name:", pending.name);
        setProfileState(pending);
        setLoading(false);
        const path = window.location.pathname;
        if (path === "/" || path === "/login" || path === "/setup-profile" || path === "/onboarding") {
          console.log("[Auth] ROUTE: pending profile → /dashboard");
          window.location.replace("/dashboard");
        }
        return;
      }

      // Fetch from Firestore
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      console.log("[Auth] PROFILE STATUS:", result.status);
      const path = window.location.pathname;

      if (result.status === "found") {
        // Clear any stale pending profile (Firestore write confirmed)
        clearPendingProfile();
        setProfileState(result.profile);
        setLoading(false);
        console.log("[Auth] ROUTE:", path, "→ profile found");
        if (path === "/" || path === "/login") {
          console.log("[Auth] ROUTE → /dashboard");
          window.location.replace("/dashboard");
        }

      } else if (result.status === "not_found") {
        setProfileState(null);
        setLoading(false);
        if (path !== "/setup-profile" && path !== "/onboarding") {
          console.log("[Auth] ROUTE → /setup-profile (new user)");
          window.location.replace("/setup-profile");
        } else {
          console.log("[Auth] ROUTE: already on setup-profile, staying");
        }

      } else {
        // Firestore error — route to setup-profile to be safe
        console.warn("[Auth] Firestore error code:", result.code, "→ /setup-profile");
        setProfileState(null);
        setLoading(false);
        if (path === "/" || path === "/login") {
          window.location.replace("/setup-profile");
        }
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
    console.log("[Auth] refreshProfile uid:", currentUser.uid);
    const result = await fetchProfile(currentUser.uid);
    if (result.status === "found") {
      clearPendingProfile();
      setProfileState(result.profile);
    }
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  // ── Google sign-in (popup with redirect fallback) ─────────────────────────

  const signInWithGoogle = async (): Promise<{ outcome: SignInOutcome; isNewUser: boolean }> => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Set VITE_FIREBASE_* env vars.");
    }
    setLoading(true);
    console.log("[Auth] signInWithGoogle — trying popup…");
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      console.log("[Auth] LOGIN RESULT:", cred.user.email, "uid:", cred.user.uid, "isNewUser:", isNewUser);
      // onAuthStateChanged handles navigation from here
      return { outcome: "success", isNewUser };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "unknown";
      console.warn("[Auth] signInWithPopup:", code);

      if (code === "auth/popup-blocked") {
        console.log("[Auth] Popup blocked — falling back to redirect…");
        try {
          await signInWithRedirect(auth, googleProvider);
          return { outcome: "redirect", isNewUser: false }; // page navigates away
        } catch (rErr: unknown) {
          console.error("[Auth] Redirect also failed:", (rErr as { code?: string })?.code, rErr);
        }
      }

      setLoading(false);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return { outcome: "cancelled", isNewUser: false };
      }
      throw err;
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────────

  const signOut = async () => {
    console.log("[Auth] Signing out…");
    clearPendingProfile();
    await firebaseSignOut(auth);
    setUser(null);
    setProfileState(null);
    setLoading(false);
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
