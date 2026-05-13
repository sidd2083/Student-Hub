import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider, isConfigured } from "@/lib/firebase";
import { getNepaliDate, getNepaliYesterday } from "@/lib/nepaliDate";

export interface UserProfile {
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

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    console.log("[Auth] Firestore READ — users/" + uid);
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.log("[Auth] Firestore READ — not found");
      return { status: "not_found" };
    }
    const d = snap.data();
    const profile: UserProfile = {
      uid: d.uid ?? uid,
      name: d.name ?? "",
      email: d.email ?? "",
      grade: d.grade ?? 0,
      role: d.role === "admin" ? "admin" : "user",
      createdAt: d.createdAt ?? new Date().toISOString(),
    };
    console.log("[Auth] Firestore READ — found:", profile.name, "grade:", profile.grade);
    return { status: "found", profile };
  } catch (err) {
    console.error("[Auth] Firestore READ error:", err);
    return { status: "error", code: "firestore_error" };
  }
}

async function checkAndBreakStreak(uid: string): Promise<void> {
  try {
    const today = getNepaliDate();
    const yesterday = getNepaliYesterday();
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const d = snap.data();
    const lastActive: string = d.lastActiveDate ?? "";
    const currentStreak: number = d.streak ?? 0;

    const updates: Record<string, unknown> = {};

    if (currentStreak > 0 && lastActive !== today && lastActive !== yesterday) {
      updates.streak = 0;
      console.log("[Auth] Streak broken — missed a day. Was:", currentStreak);
    }

    if (lastActive && lastActive !== today && (d.todayStudyTime ?? 0) > 0) {
      updates.todayStudyTime = 0;
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "users", uid), updates);
    }
  } catch (err) {
    console.warn("[Auth] checkAndBreakStreak failed:", err);
  }
}

async function patchProfileFromFirebase(uid: string, firebaseUser: FirebaseUser, profile: UserProfile): Promise<UserProfile> {
  const updates: Record<string, unknown> = {};
  if (!profile.name && firebaseUser.displayName) updates.name = firebaseUser.displayName;
  if (!profile.email && firebaseUser.email) updates.email = firebaseUser.email;
  if (Object.keys(updates).length === 0) return profile;
  try {
    console.log("[Auth] Auto-patching missing profile fields:", Object.keys(updates));
    await updateDoc(doc(db, "users", uid), updates);
    return { ...profile, name: (updates.name as string) ?? profile.name, email: (updates.email as string) ?? profile.email };
  } catch {
    return profile;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileRef = useRef<UserProfile | null>(null);

  const applyProfile = useCallback((p: UserProfile | null) => {
    profileRef.current = p;
    setProfileState(p);
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isConfigured) {
      console.error("[Auth] ❌ Firebase not configured — auth disabled");
      setLoading(false);
      return;
    }

    console.log("[Auth] Initialising auth listener…");

    getRedirectResult(auth)
      .then(async (result: UserCredential | null) => {
        if (result?.user) {
          console.log("[Auth] REDIRECT RESULT:", result.user.email);
          const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
          if (isNewUser) {
            window.location.replace("/setup-profile");
          } else {
            const pr = await fetchProfile(result.user.uid);
            if (pr.status === "found") {
              applyProfile(pr.profile);
              window.location.replace("/dashboard");
            } else if (pr.status === "not_found") {
              window.location.replace("/setup-profile");
            } else {
              window.location.replace("/dashboard");
            }
          }
        }
      })
      .catch((err: unknown) => {
        console.error("[Auth] REDIRECT RESULT error:", (err as { code?: string })?.code);
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (!firebaseUser) {
        setUser(null);
        applyProfile(null);
        setLoading(false);
        const path = window.location.pathname;
        const isProtected = /^\/dashboard|^\/settings/.test(path);
        if (isProtected) {
          window.location.replace("/login");
        }
        return;
      }

      setUser(firebaseUser);

      if (profileRef.current) {
        setLoading(false);
        return;
      }

      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      const currentPath = window.location.pathname;

      if (result.status === "found") {
        // Break streak BEFORE displaying profile so the user sees the corrected value
        await checkAndBreakStreak(firebaseUser.uid);
        // Re-fetch to pick up any streak reset that just happened
        const freshResult = await fetchProfile(firebaseUser.uid);
        const freshProfile = freshResult.status === "found" ? freshResult.profile : result.profile;
        const patched = await patchProfileFromFirebase(firebaseUser.uid, firebaseUser, freshProfile);
        if (!mounted) return;
        applyProfile(patched);
        setLoading(false);
        if (currentPath === "/" || currentPath === "/login") {
          window.location.replace("/dashboard");
        }
      } else if (result.status === "not_found") {
        applyProfile(null);
        setLoading(false);
        const safePages = ["/setup-profile", "/onboarding"];
        if (!safePages.some(p => currentPath.startsWith(p))) {
          console.log("[Auth] no profile → /setup-profile");
          window.location.replace("/setup-profile");
        }
      } else {
        console.warn("[Auth] Firestore error:", result.code);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const result = await fetchProfile(currentUser.uid);
    if (result.status === "found") applyProfile(result.profile);
  }, [applyProfile]);

  const setProfile = useCallback((p: UserProfile | null) => {
    applyProfile(p);
  }, [applyProfile]);

  const signInWithGoogle = async (): Promise<{ outcome: SignInOutcome; isNewUser: boolean }> => {
    if (!isConfigured) throw new Error("Firebase not configured.");
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      console.log("[Auth] LOGIN:", cred.user.email, "isNewUser:", isNewUser);

      if (isNewUser) {
        window.location.replace("/setup-profile");
        return { outcome: "success", isNewUser: true };
      }

      const pr = await fetchProfile(cred.user.uid);
      if (pr.status === "found") {
        const patched = await patchProfileFromFirebase(cred.user.uid, cred.user, pr.profile);
        applyProfile(patched);
        window.location.replace("/dashboard");
      } else if (pr.status === "not_found") {
        window.location.replace("/setup-profile");
      } else {
        window.location.replace("/setup-profile");
      }

      return { outcome: "success", isNewUser };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "unknown";
      if (code === "auth/popup-blocked") {
        await signInWithRedirect(auth, googleProvider);
        return { outcome: "redirect", isNewUser: false };
      }
      setLoading(false);
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return { outcome: "cancelled", isNewUser: false };
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    applyProfile(null);
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
