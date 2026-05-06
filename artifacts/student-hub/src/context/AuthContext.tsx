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

// ─── sessionStorage pending-profile bridge ────────────────────────────────────
// Used to survive the full page reload caused by window.location.replace.
// Onboarding writes here; AuthContext reads it as a fallback when Firestore
// hasn't finished writing yet.

const PENDING_KEY = "pendingProfile_v1";
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readPendingProfile(uid: string): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.uid !== uid) return null;
    if (Date.now() - (data._savedAt ?? 0) > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    const { _savedAt: _, ...rest } = data;
    return { id: 0, ...rest } as UserProfile;
  } catch {
    return null;
  }
}

function clearPendingProfile() {
  sessionStorage.removeItem(PENDING_KEY);
}

// ─── Firestore profile fetch ──────────────────────────────────────────────────

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    console.log("[Auth] Firestore READ — users/" + uid);
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Firestore READ — no document");
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
          console.log("Login success:", result.user.uid);
          if (isNewUser) {
            window.location.replace("/setup-profile");
          } else {
            window.location.replace("/dashboard");
          }
        } else {
          console.log("[Auth] REDIRECT RESULT: none pending");
        }
      })
      .catch((err: unknown) => {
        console.error("[Auth] REDIRECT RESULT error:", (err as { code?: string })?.code, err);
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      // ── No user ──────────────────────────────────────────────────────────
      if (!firebaseUser) {
        setUser(null);
        setProfileState(null);
        setLoading(false);
        const path = window.location.pathname;
        const isProtected = /^\/dashboard|^\/settings/.test(path);
        if (isProtected) {
          console.log("[Auth] no user on protected page → /login");
          window.location.replace("/login");
        }
        return;
      }

      // ── User signed in ────────────────────────────────────────────────────
      setUser(firebaseUser);

      const path = window.location.pathname;
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      if (result.status === "found") {
        setProfileState(result.profile);
        setLoading(false);
        clearPendingProfile(); // Firestore has it — no longer need the bridge

        if (path === "/" || path === "/login") {
          console.log("[Auth] profile found, on login → /dashboard");
          window.location.replace("/dashboard");
        }

      } else if (result.status === "not_found") {
        // ── Check sessionStorage bridge first ─────────────────────────────
        const pending = readPendingProfile(firebaseUser.uid);

        if (pending) {
          console.log("[Auth] sessionStorage bridge hit — using pending profile:", pending.name);
          setProfileState(pending);
          setLoading(false);

          // Write to Firestore now so subsequent reloads don't need the bridge
          const firestoreData = {
            uid: pending.uid,
            name: pending.name,
            email: pending.email,
            grade: pending.grade,
            role: pending.role,
            createdAt: pending.createdAt,
            streak: 0,
            totalStudyTime: 0,
            todayStudyTime: 0,
            lastActiveDate: null,
          };
          setDoc(doc(db, "users", firebaseUser.uid), firestoreData)
            .then(() => {
              console.log("[Auth] sessionStorage bridge: Firestore write ✅");
              clearPendingProfile();
            })
            .catch((err) => console.error("[Auth] sessionStorage bridge: Firestore write failed:", err));

          // Also sync to backend
          fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: pending.uid,
              name: pending.name,
              email: pending.email,
              grade: pending.grade,
              role: pending.role,
            }),
          }).catch(() => {});

          // Stay on dashboard — don't redirect
        } else {
          // Genuinely no profile — send to setup
          setProfileState(null);
          setLoading(false);

          if (path !== "/setup-profile" && path !== "/onboarding") {
            console.log("[Auth] no profile found → /setup-profile");
            window.location.replace("/setup-profile");
          }
        }

      } else {
        // Firestore error — don't redirect, let user stay
        console.warn("[Auth] Firestore error code:", result.code);
        setLoading(false);
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
      setProfileState(result.profile);
    }
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  // ── Google sign-in: popup with redirect fallback ───────────────────────────

  const signInWithGoogle = async (): Promise<{ outcome: SignInOutcome; isNewUser: boolean }> => {
    if (!isConfigured) {
      throw new Error("Firebase is not configured. Set VITE_FIREBASE_* env vars.");
    }
    setLoading(true);
    console.log("[Auth] signInWithGoogle — trying popup…");

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      console.log("Login success:", cred.user.uid);
      console.log("[Auth] LOGIN:", cred.user.email, "isNewUser:", isNewUser);

      if (isNewUser) {
        window.location.replace("/setup-profile");
      } else {
        window.location.replace("/dashboard");
      }

      return { outcome: "success", isNewUser };

    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "unknown";
      console.warn("[Auth] signInWithPopup error:", code);

      if (code === "auth/popup-blocked") {
        console.log("[Auth] Popup blocked — falling back to redirect…");
        try {
          await signInWithRedirect(auth, googleProvider);
          return { outcome: "redirect", isNewUser: false };
        } catch (rErr: unknown) {
          console.error("[Auth] Redirect failed:", (rErr as { code?: string })?.code, rErr);
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
