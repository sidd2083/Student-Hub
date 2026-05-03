import { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useLocation } from "wouter";

interface UserProfile {
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
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch(`/api/users/${uid}`);
      if (res.status === 404) return null;
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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const p = await fetchProfile(firebaseUser.uid);
        setProfile(p);
        if (!p) {
          setLocation("/onboarding");
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
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
