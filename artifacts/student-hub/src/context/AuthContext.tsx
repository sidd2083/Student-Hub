import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Stay in loading until redirect result AND auth state are both resolved
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

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
    const p = await fetchProfile(user.uid);
    setProfile(p);
  };

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;
    let mounted = true;

    const initialize = async () => {
      // Process Google redirect result first — this must complete before
      // we attach the auth listener so we see the correct user state.
      try {
        await getRedirectResult(auth);
      } catch {
        // Ignore domain / cancelled redirect errors
      }

      if (!mounted) return;

      // Now attach auth state listener — it fires synchronously with the
      // current user (or null) that Firebase already has in memory.
      unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;

        if (firebaseUser) {
          setUser(firebaseUser);
          const p = await fetchProfile(firebaseUser.uid);
          if (!mounted) return;
          setProfile(p);
          setLoading(false);

          // Route: new user → onboarding, returning user on "/" → dashboard
          if (!p) {
            setLocation("/onboarding");
          } else {
            const currentPath = locationRef.current;
            if (currentPath === "/" || currentPath === "") {
              setLocation("/dashboard");
            }
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
