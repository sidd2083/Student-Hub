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

// ─── Profile Cache + Auth Hint ────────────────────────────────────────────────
// The profile cache stores full user data; the auth hint is a lightweight flag
// that tells AppShell "someone was logged in on this device" so it can show the
// authenticated layout instantly — even before the profile cache is available.
const PROFILE_CACHE_KEY = "studenthub_profile_v2";
const AUTH_HINT_KEY  = "sh_authed"; // "1" = was logged in on this device
const GUEST_HINT_KEY = "sh_guest";  // "1" = explicitly logged out on this device

// setAuthHint(true)  → marks device as authenticated (clears guest flag)
// setAuthHint(false) → marks device as guest (clears auth flag)
// AppShell reads both flags synchronously so the correct layout is shown
// on the very first render, with zero flicker in either direction.
function setAuthHint(authed: boolean) {
  try {
    if (authed) {
      localStorage.setItem(AUTH_HINT_KEY, "1");
      localStorage.removeItem(GUEST_HINT_KEY);
    } else {
      localStorage.removeItem(AUTH_HINT_KEY);
      localStorage.setItem(GUEST_HINT_KEY, "1");
    }
  } catch {}
}

function getCachedProfile(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { uid: string; profile: UserProfile };
    if (data.uid !== uid) return null;
    return data.profile;
  } catch {
    return null;
  }
}

/** Read cached profile without needing a uid — used for instant startup */
function getEarlyProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { uid: string; profile: UserProfile };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

function setCachedProfile(uid: string, profile: UserProfile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, profile }));
  } catch {}
}

function clearProfileCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch {}
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

async function fetchProfile(uid: string): Promise<ProfileResult> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return { status: "not_found" };
    const d = snap.data();
    const profile: UserProfile = {
      uid: d.uid ?? uid,
      name: d.name ?? "",
      email: d.email ?? "",
      grade: d.grade ?? 0,
      role: d.role === "admin" ? "admin" : "user",
      createdAt: d.createdAt ?? new Date().toISOString(),
    };
    return { status: "found", profile };
  } catch (err) {
    console.error("[Auth] Firestore READ error:", err);
    return { status: "error", code: "firestore_error" };
  }
}

/** Reset streak if user missed a day — runs in background, non-blocking */
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
    await updateDoc(doc(db, "users", uid), updates);
    return { ...profile, name: (updates.name as string) ?? profile.name, email: (updates.email as string) ?? profile.email };
  } catch {
    return profile;
  }
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  // Seed profile from localStorage immediately — avoids LoadingScreen flash on PWA launch
  const [profile, setProfileState] = useState<UserProfile | null>(() => getEarlyProfile());
  // Skip loading state if we have a cached profile (Firebase will verify in background)
  const [loading, setLoading] = useState(() => !getEarlyProfile());

  const profileRef = useRef<UserProfile | null>(null);

  const applyProfile = useCallback((p: UserProfile | null) => {
    profileRef.current = p;
    setProfileState(p);
    if (p) {
      setCachedProfile(p.uid, p);
      setAuthHint(true);   // user is logged in — set hint for instant layout on next open
    } else {
      setAuthHint(false);  // user logged out — clear hint immediately
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isConfigured) {
      console.error("[Auth] ❌ Firebase not configured — auth disabled");
      setLoading(false);
      return;
    }

    // Handle Google redirect sign-in result
    getRedirectResult(auth)
      .then(async (result: UserCredential | null) => {
        if (!result?.user) return;
        const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
        if (isNewUser) {
          window.location.replace("/setup-profile");
        } else {
          const pr = await fetchProfile(result.user.uid);
          if (pr.status === "found") {
            applyProfile(pr.profile);
            window.location.replace("/dashboard");
          } else {
            window.location.replace("/setup-profile");
          }
        }
      })
      .catch((err: unknown) => {
        console.error("[Auth] REDIRECT RESULT error:", (err as { code?: string })?.code);
      });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      // ── Not logged in ──────────────────────────────────────────────────────
      if (!firebaseUser) {
        setUser(null);
        applyProfile(null);
        clearProfileCache();
        setLoading(false);
        const path = window.location.pathname;
        if (/^\/dashboard|^\/settings/.test(path)) {
          window.location.replace("/login");
        }
        return;
      }

      setUser(firebaseUser);

      // ── Fast path: use localStorage cache for instant startup ──────────────
      const cached = getCachedProfile(firebaseUser.uid);
      const alreadyHasProfile = profileRef.current;

      if (cached || alreadyHasProfile) {
        // Show immediately from cache — user sees content in <200ms
        if (cached && !alreadyHasProfile) {
          applyProfile(cached);
        }
        setLoading(false);

        // Verify with Firestore in background (non-blocking)
        fetchProfile(firebaseUser.uid).then(async result => {
          if (!mounted) return;
          if (result.status === "found") {
            const patched = await patchProfileFromFirebase(firebaseUser.uid, firebaseUser, result.profile);
            if (!mounted) return;
            applyProfile(patched);
            // Run streak check in background — don't block UI
            checkAndBreakStreak(firebaseUser.uid).then(async () => {
              if (!mounted) return;
              const fresh = await fetchProfile(firebaseUser.uid);
              if (!mounted) return;
              if (fresh.status === "found") applyProfile(fresh.profile);
            }).catch(() => {});
          }
        }).catch(() => {});
        return;
      }

      // ── First login: fetch from Firestore then show ────────────────────────
      const result = await fetchProfile(firebaseUser.uid);
      if (!mounted) return;

      const currentPath = window.location.pathname;

      if (result.status === "found") {
        const patched = await patchProfileFromFirebase(firebaseUser.uid, firebaseUser, result.profile);
        if (!mounted) return;
        applyProfile(patched);
        setLoading(false);

        if (currentPath === "/" || currentPath === "/login") {
          window.location.replace("/dashboard");
        }

        // Streak check runs in background after content is visible
        checkAndBreakStreak(firebaseUser.uid).then(async () => {
          if (!mounted) return;
          const fresh = await fetchProfile(firebaseUser.uid);
          if (!mounted) return;
          if (fresh.status === "found") applyProfile(fresh.profile);
        }).catch(() => {});

      } else if (result.status === "not_found") {
        applyProfile(null);
        setLoading(false);
        const safePages = ["/setup-profile", "/onboarding"];
        if (!safePages.some(p => currentPath.startsWith(p))) {
          window.location.replace("/setup-profile");
        }
      } else {
        console.warn("[Auth] Firestore error:", result.code);
        // On error, still show loading=false so the app doesn't hang forever
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

      if (isNewUser) {
        window.location.replace("/setup-profile");
        return { outcome: "success", isNewUser: true };
      }

      const pr = await fetchProfile(cred.user.uid);
      if (pr.status === "found") {
        const patched = await patchProfileFromFirebase(cred.user.uid, cred.user, pr.profile);
        applyProfile(patched);
        window.location.replace("/dashboard");
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
    clearProfileCache();
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
