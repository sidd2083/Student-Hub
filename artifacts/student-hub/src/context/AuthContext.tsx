import { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
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
    } catch {
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
    let unsubAuth: (() => void) | undefined;
    let mounted = true;

    const initialize = async () => {
      try {
        await getRedirectResult(auth);
      } catch {
      }

      if (!mounted) return;

      unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;

        if (firebaseUser) {
          setUser(firebaseUser);

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
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });
    };

    initialize();

    return () => {
      mounted = false;
      unsubAuth?.();
    };
  }, []);

  const signInWithGoogle = async () => {
    await signInWithRedirect(auth, googleProvider);
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
