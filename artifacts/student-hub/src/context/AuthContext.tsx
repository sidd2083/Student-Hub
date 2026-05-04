import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setProfile: (p: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Profile: not found in Firestore");
      return null;
    }
    const d = snap.data();
    const profile: UserProfile = {
      id: 0,
      uid: d.uid ?? uid,
      name: d.name ?? "",
      email: d.email ?? "",
      grade: d.grade ?? 0,
      role: d.role === "admin" ? "admin" : "user",
      createdAt:
        typeof d.createdAt === "string"
          ? d.createdAt
          : new Date().toISOString(),
    };
    console.log("[Auth] Profile found:", profile.name, "| role:", profile.role);
    return profile;
  } catch (err) {
    console.error("[Auth] Firestore error:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Single atomic state — prevents any intermediate render where
  // e.g. user=X but loading=false and profile=null simultaneously
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    console.log("[Auth] Auth loading...");

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (firebaseUser) {
        console.log("[Auth] User:", firebaseUser.email);
        const p = await fetchProfile(firebaseUser.uid);
        if (!mounted) return;
        console.log("[Auth] Profile:", p ? p.name : "null");
        // One render — all three values land together
        setState({ user: firebaseUser, profile: p, loading: false });
      } else {
        console.log("[Auth] No user signed in");
        setState({ user: null, profile: null, loading: false });
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Used by Onboarding after saving to Firestore
  const setProfile = useCallback((p: UserProfile | null) => {
    setState((prev) => ({ ...prev, profile: p }));
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      )
        return;
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setState({ user: null, profile: null, loading: false });
  };

  return (
    <AuthContext.Provider
      value={{ ...state, signInWithGoogle, signOut, setProfile }}
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
