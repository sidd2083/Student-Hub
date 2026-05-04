import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  photoURL?: string;
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

async function fetchProfileOnce(uid: string): Promise<UserProfile | null> {
  console.log("[Auth] Fetching Firestore profile for uid:", uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Profile not found in Firestore");
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
        typeof d.createdAt === "string" ? d.createdAt : new Date().toISOString(),
      photoURL: d.photoURL,
    };
    console.log("[Auth] Profile found:", profile.name, "| role:", profile.role);
    return profile;
  } catch (err) {
    console.error("[Auth] Firestore fetch error:", err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    console.log("[Auth] Auth loading...");

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      if (fetchingRef.current) return;

      if (firebaseUser) {
        console.log("[Auth] User found:", firebaseUser.email);
        fetchingRef.current = true;
        setUser(firebaseUser);

        const p = await fetchProfileOnce(firebaseUser.uid);
        if (!mounted) return;

        setProfile(p);
        setLoading(false);
        fetchingRef.current = false;

        if (p) {
          console.log("[Auth] → Profile exists. Ready for /dashboard.");
        } else {
          console.log("[Auth] → No profile. Redirecting to /setup-profile.");
        }
      } else {
        console.log("[Auth] No user. Redirecting to /login.");
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

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfileOnce(user.uid);
    setProfile(p);
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOut,
        refreshProfile,
        setProfile,
      }}
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
