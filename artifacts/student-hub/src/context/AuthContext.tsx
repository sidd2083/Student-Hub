import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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

  // Ref so onAuthStateChanged callback (captured once at mount) can always
  // see whether a profile has already been set — avoids stale-closure bug.
  const profileRef = useRef<UserProfile | null>(null);

  const applyProfile = useCallback((p: UserProfile | null) => {
    profileRef.current = p;
    setProfileState(p);
  }, []);

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
      .then(async (result: UserCredential | null) => {
        if (result?.user) {
          console.log("[Auth] REDIRECT RESULT:", result.user.email);
          const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
          if (isNewUser) {
            window.location.replace("/setup-profile");
          } else {
            // Existing Firebase user — verify profile in our DB before navigating
            const pr = await fetchProfile(result.user.uid);
            if (pr.status === "found") {
              applyProfile(pr.profile);
              window.location.replace("/dashboard");
            } else if (pr.status === "not_found") {
              window.location.replace("/setup-profile");
            } else {
              // API error — let them into dashboard, profile will retry
              window.location.replace("/dashboard");
            }
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
        applyProfile(null);
        setLoading(false);
        const path = window.location.pathname;
        const isProtected = /^\/dashboard|^\/settings/.test(path);
        if (isProtected) {
          window.location.replace("/login");
        }
        return;
      }

      setUser(firebaseUser);

      // If profile is already set (by signInWithGoogle or Onboarding), skip re-fetch.
      // Uses a ref so this check always reflects current state, not a stale closure.
      if (profileRef.current) {
        setLoading(false);
        return;
      }

      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      // Re-read the CURRENT path AFTER the async fetch — by now signInWithGoogle
      // may have already navigated (e.g. to /dashboard), so we must not override it.
      const currentPath = window.location.pathname;

      if (result.status === "found") {
        applyProfile(result.profile);
        setLoading(false);
        if (currentPath === "/" || currentPath === "/login") {
          window.location.replace("/dashboard");
        }
      } else if (result.status === "not_found") {
        applyProfile(null);
        setLoading(false);
        // Only redirect to setup-profile if we are NOT already navigating to a
        // protected destination (signInWithGoogle already sent the user to /dashboard
        // for the "existing Firebase user, not yet in our DB" edge case — that path
        // will correctly redirect them to /setup-profile via the PrivateRoute guard).
        const safePages = ["/setup-profile", "/onboarding", "/dashboard", "/"];
        if (!safePages.some(p => currentPath.startsWith(p))) {
          console.log("[Auth] no profile → /setup-profile");
          window.location.replace("/setup-profile");
        }
      } else {
        // API error — don't redirect, just stop the loading spinner.
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
    if (result.status === "found") applyProfile(result.profile);
  }, [applyProfile]);

  const setProfile = useCallback((p: UserProfile | null) => {
    applyProfile(p);
  }, [applyProfile]);

  const signInWithGoogle = async (): Promise<{ outcome: SignInOutcome; isNewUser: boolean }> => {
    if (!isConfigured) throw new Error("Firebase not configured.");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      console.log("[Auth] LOGIN:", cred.user.email, "isNewUser:", isNewUser);

      if (isNewUser) {
        window.location.replace("/setup-profile");
        return { outcome: "success", isNewUser: true };
      }

      // Existing Firebase user — check if they have a profile in our database.
      // We do this HERE (before navigating) so the result is set in the ref,
      // which prevents onAuthStateChanged from doing a redundant re-fetch and
      // potentially racing with us on the redirect destination.
      const pr = await fetchProfile(cred.user.uid);
      if (pr.status === "found") {
        applyProfile(pr.profile);
        window.location.replace("/dashboard");
      } else if (pr.status === "not_found") {
        // Existing Firebase account, but no profile in our DB yet (e.g. first
        // login after migration). Send them through setup.
        window.location.replace("/setup-profile");
      } else {
        // API error (network issue, server down, etc.) — let them into the
        // dashboard. The onAuthStateChanged listener will retry the fetch.
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
    applyProfile(null);
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
