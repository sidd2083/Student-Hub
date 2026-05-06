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
import { auth, googleProvider, isConfigured } from "@/lib/firebase";

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

// ─── Profile fetch from backend API (PostgreSQL) ──────────────────────────────
// Single source of truth — avoids Firestore security rule issues entirely.

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    console.log("[Auth] API READ — /api/users/" + uid);
    const res = await fetch(`/api/users/${uid}`);
    if (res.status === 404) {
      console.log("[Auth] API READ — not found");
      return { status: "not_found" };
    }
    if (!res.ok) {
      console.error("[Auth] API READ — error", res.status);
      return { status: "error", code: `http_${res.status}` };
    }
    const d = await res.json();
    const profile: UserProfile = {
      id: d.id ?? 0,
      uid: d.uid ?? uid,
      name: d.name ?? "",
      email: d.email ?? "",
      grade: d.grade ?? 0,
      role: d.role === "admin" ? "admin" : "user",
      createdAt: d.createdAt ?? new Date().toISOString(),
    };
    console.log("[Auth] API READ — found:", profile.name, "grade:", profile.grade);
    return { status: "found", profile };
  } catch (err) {
    console.error("[Auth] API READ error:", err);
    return { status: "error", code: "network" };
  }
}

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
          const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
          if (isNewUser) {
            window.location.replace("/setup-profile");
          } else {
            window.location.replace("/dashboard");
          }
        }
      })
      .catch((err: unknown) => {
        console.error("[Auth] REDIRECT RESULT error:", (err as { code?: string })?.code);
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (!firebaseUser) {
        setUser(null);
        setProfileState(null);
        setLoading(false);
        const path = window.location.pathname;
        const isProtected = /^\/dashboard|^\/settings/.test(path);
        if (isProtected) {
          window.location.replace("/login");
        }
        return;
      }

      setUser(firebaseUser);

      // If we already have a profile in state (set by Onboarding) keep it —
      // no need to re-fetch from the API on every auth state change
      if (profile) {
        setLoading(false);
        return;
      }

      const path = window.location.pathname;
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      if (result.status === "found") {
        setProfileState(result.profile);
        setLoading(false);
        if (path === "/" || path === "/login") {
          window.location.replace("/dashboard");
        }
      } else if (result.status === "not_found") {
        setProfileState(null);
        setLoading(false);
        if (path !== "/setup-profile" && path !== "/onboarding") {
          console.log("[Auth] no profile → /setup-profile");
          window.location.replace("/setup-profile");
        }
      } else {
        console.warn("[Auth] API error:", result.code);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const result = await fetchProfile(currentUser.uid);
    if (result.status === "found") setProfileState(result.profile);
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  const signInWithGoogle = async (): Promise<{ outcome: SignInOutcome; isNewUser: boolean }> => {
    if (!isConfigured) throw new Error("Firebase not configured.");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      console.log("[Auth] LOGIN:", cred.user.email, "isNewUser:", isNewUser);
      if (isNewUser) {
        window.location.replace("/setup-profile");
      } else {
        window.location.replace("/dashboard");
      }
      return { outcome: "success", isNewUser };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "unknown";
      if (code === "auth/popup-blocked") {
        await signInWithRedirect(auth, googleProvider);
        return { outcome: "redirect", isNewUser: false };
      }
      setLoading(false);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return { outcome: "cancelled", isNewUser: false };
      }
      throw err;
    }
  };

  const signOut = async () => {
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
