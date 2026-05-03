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

async function fetchProfileFromFirestore(uid: string): Promise<UserProfile | null> {
  try {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      id: 0,
      uid: data.uid ?? uid,
      name: data.name ?? "",
      email: data.email ?? "",
      grade: data.grade ?? 0,
      role: (data.role === "admin" ? "admin" : "user") as "user" | "admin",
      createdAt:
        typeof data.createdAt === "string"
          ? data.createdAt
          : new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch profile from Firestore:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfileFromFirestore(user.uid);
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const p = await fetchProfileFromFirestore(firebaseUser.uid);
          if (!mounted) return;
          setProfile(p);
          setLoading(false);

          if (isAtRootPath()) {
            setLocation(p ? "/dashboard" : "/setup-profile");
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
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
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
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
    <AuthContext.Provider
      value={{ user, profile, loading, signInWithGoogle, signOut, refreshProfile, setProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
