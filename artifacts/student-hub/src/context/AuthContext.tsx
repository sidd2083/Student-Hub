import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
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

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    console.log("[Auth] Checking Firestore for uid:", uid);
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Profile: not found in Firestore — new user");
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
    console.log("[Auth] Profile found:", profile.name, "| grade:", profile.grade, "| role:", profile.role);
    return { status: "found", profile };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "unknown";
    console.error("[Auth] Firestore read error:", code, err);
    return { status: "error", code };
  }
}

// Paths that unauthenticated users can access without being redirected to /
const PUBLIC_PATH_REGEX =
  /^\/?$|^\/login|^\/notes|^\/pyqs|^\/pyq|^\/about|^\/contact|^\/ai|^\/report|^\/todo|^\/pomodoro|^\/leaderboard|^\/admin/;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    console.log("[Auth] Initialising auth listener…");

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      console.log("[Auth] USER:", firebaseUser?.email ?? null);

      if (!firebaseUser) {
        setUser(null);
        setProfileState(null);
        setLoading(false);
        const path = window.location.pathname;
        if (!PUBLIC_PATH_REGEX.test(path)) {
          console.log("[Auth] → no user, not a public path, routing to /");
          window.location.replace("/");
        } else {
          console.log("[Auth] → no user, public/soft-gate route, staying at", path);
        }
        return;
      }

      // User is signed in — check Firestore for their profile
      setUser(firebaseUser);
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      console.log("[Auth] PROFILE STATUS:", result.status);
      const path = window.location.pathname;

      if (result.status === "found") {
        // ✅ Existing user — go to dashboard
        setProfileState(result.profile);
        setLoading(false);
        if (path === "/" || path === "/login") {
          console.log("[Auth] → existing user, routing to /dashboard");
          window.location.replace("/dashboard");
        }

      } else if (result.status === "not_found") {
        // 🆕 Brand-new user — must go through setup
        setProfileState(null);
        setLoading(false);
        if (path !== "/setup-profile" && path !== "/onboarding") {
          console.log("[Auth] → new user (no Firestore doc), routing to /setup-profile");
          window.location.replace("/setup-profile");
        }

      } else {
        // ⚠️  Firestore read failed (permissions, network, etc.)
        // Treat as "unknown" — route to setup-profile if on an auth page
        // so a genuinely new user is never silently bypassed into /dashboard.
        console.warn("[Auth] Firestore read failed (code:", result.code, ")");
        console.warn("[Auth] Cannot confirm profile — routing to /setup-profile for safety");
        setProfileState(null);
        setLoading(false);
        if (path === "/" || path === "/login") {
          window.location.replace("/setup-profile");
        } else if (path !== "/setup-profile" && path !== "/onboarding") {
          // Already somewhere in the app — leave them where they are;
          // they will see restricted content through SoftGate overlays.
          console.log("[Auth] → Firestore error but already at", path, "— staying");
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
    const result = await fetchProfile(currentUser.uid);
    if (result.status === "found") setProfileState(result.profile);
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  const signInWithGoogle = async () => {
    if (!isConfigured) {
      throw new Error(
        "Firebase is not configured. Please set the VITE_FIREBASE_* environment variables."
      );
    }
    setLoading(true);
    try {
      console.log("[Auth] Opening Google sign-in popup…");
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles redirect from here
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setLoading(false);
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) return;
      throw err;
    }
  };

  const signOut = async () => {
    console.log("[Auth] Signing out…");
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
