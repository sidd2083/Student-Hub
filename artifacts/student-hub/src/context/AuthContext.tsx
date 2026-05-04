import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

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
  | { status: "error" };

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
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Profile: not found in Firestore");
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
    console.error("[Auth] Firestore error:", code, err);
    return { status: "error" };
  }
}

// Paths that unauthenticated users can access without being redirected to /
// Includes: home, login, public content, soft-gated tools (they see blur overlay)
const PUBLIC_PATH_REGEX =
  /^\/?$|^\/login|^\/notes|^\/pyqs|^\/pyq|^\/about|^\/contact|^\/ai|^\/mcq|^\/todo|^\/pomodoro|^\/leaderboard/;

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

      // User is signed in — fetch Firestore profile
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      setUser(firebaseUser);
      console.log("[Auth] PROFILE:", result.status);

      if (result.status === "found") {
        setProfileState(result.profile);
        setLoading(false);
        const path = window.location.pathname;
        if (path === "/" || path === "/login") {
          console.log("[Auth] → existing user, routing to /dashboard");
          window.location.replace("/dashboard");
        }
      } else if (result.status === "not_found") {
        setProfileState(null);
        setLoading(false);
        const path = window.location.pathname;
        if (path !== "/setup-profile" && path !== "/onboarding") {
          console.log("[Auth] → new user, routing to /setup-profile");
          window.location.replace("/setup-profile");
        }
      } else {
        // Firestore error — build fallback profile from Firebase Auth
        console.warn("[Auth] Firestore read failed — using fallback profile from Firebase Auth");
        const fallback: UserProfile = {
          id: 0,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName ?? "Student",
          email: firebaseUser.email ?? "",
          grade: 10,
          role: "user",
          createdAt: new Date().toISOString(),
        };
        setProfileState(fallback);
        setLoading(false);
        const path = window.location.pathname;
        if (path === "/" || path === "/login") {
          console.log("[Auth] → fallback profile, routing to /dashboard");
          window.location.replace("/dashboard");
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
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles everything from here
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
