import { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import { useLocation } from "wouter";

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  grade: number;
  role: "user" | "admin";
  createdAt: string;
}

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

function isAtRootPath() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const path = window.location.pathname;
  return path === base || path === base + "/" || path === "/";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`/api/users/${uid}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const docSnap = await getDoc(doc(db, "users", user.uid));
    const hasProfile = docSnap.exists();
    const p = hasProfile ? await fetchProfile(user.uid) : null;
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          const docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (!mounted) return;
          const hasProfile = docSnap.exists();

          const p = hasProfile ? await fetchProfile(firebaseUser.uid) : null;
          if (!mounted) return;

          setProfile(p);
          setLoading(false);

          if (isAtRootPath()) {
            if (hasProfile) setLocation("/dashboard");
            else setLocation("/setup-profile");
          }
        } catch (err) {
          console.error("Error checking user profile:", err);
          if (!mounted) return;
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error("Google sign-in error:", err);
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return;
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    setLocation("/");
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
