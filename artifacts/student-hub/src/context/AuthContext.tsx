import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
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
  photoURL?: string;
}

interface StreakExtras {
  lastActiveDate: string;
  streak: number;
  todayStudyTime: number;
}

type ProfileResult =
  | { status: "found"; profile: UserProfile; extras: StreakExtras }
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

export const AuthContext = createContext<AuthContextType | null>(null);

// ─── Profile Cache + Auth Hint ────────────────────────────────────────────────
// The profile cache stores full user data; the auth hint is a lightweight flag
// that tells AppShell "someone was logged in on this device" so it can show the
// authenticated layout instantly — even before the profile cache is available.
const PROFILE_CACHE_KEY = "studenthub_profile_v2";
// "sh_authed" = "1" means Firebase confirmed this user is logged in on this device.
// It is set the moment Firebase Auth fires with a valid user (before any Firestore fetch),
// and cleared ONLY on explicit logout or when Firebase itself says the user is signed out.
// It is NEVER cleared due to a missing Firestore profile (transient errors, new users, etc.)
// so it can't cause false "logged out" flashes.
const AUTH_HINT_KEY = "sh_authed";

function setAuthHint(authed: boolean) {
  try {
    if (authed) localStorage.setItem(AUTH_HINT_KEY, "1");
    else localStorage.removeItem(AUTH_HINT_KEY);
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
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, profile, ts: Date.now() }));
  } catch {}
}

/** True if the cached profile is less than 5 minutes old — skip background re-fetch. */
function isProfileCacheFresh(uid: string): boolean {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { uid: string; ts?: number };
    return data.uid === uid && !!data.ts && Date.now() - data.ts < 5 * 60 * 1000;
  } catch { return false; }
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
      photoURL: d.photoURL ?? undefined,
    };
    const extras: StreakExtras = {
      lastActiveDate: d.lastActiveDate ?? "",
      streak: d.streak ?? 0,
      todayStudyTime: d.todayStudyTime ?? 0,
    };
    return { status: "found", profile, extras };
  } catch (err) {
    console.error("[Auth] Firestore READ error:", err);
    return { status: "error", code: "firestore_error" };
  }
}

/**
 * Reset streak if user missed a day.
 * Accepts the already-fetched Firestore data so no extra getDoc is needed.
 * Returns true if any Firestore updates were written (caller should re-fetch profile).
 * Runs in background, non-blocking.
 */
async function checkAndBreakStreak(uid: string, extras: StreakExtras): Promise<boolean> {
  try {
    const today = getNepaliDate();
    const yesterday = getNepaliYesterday();
    const { lastActiveDate: lastActive, streak: currentStreak, todayStudyTime } = extras;
    const updates: Record<string, unknown> = {};
    if (currentStreak > 0 && lastActive !== today && lastActive !== yesterday) {
      updates.streak = 0;
      console.log("[Auth] Streak broken — missed a day. Was:", currentStreak);
    }
    if (lastActive && lastActive !== today && todayStudyTime > 0) {
      updates.todayStudyTime = 0;
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "users", uid), updates);
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[Auth] checkAndBreakStreak failed:", err);
    return false;
  }
}

async function patchProfileFromFirebase(uid: string, firebaseUser: FirebaseUser, profile: UserProfile): Promise<UserProfile> {
  const updates: Record<string, unknown> = {};
  if (!profile.name && firebaseUser.displayName) updates.name = firebaseUser.displayName;
  if (!profile.email && firebaseUser.email) updates.email = firebaseUser.email;
  // NOTE: We never auto-sync Google's photoURL. Avatar = custom uploaded photo or letter initial.
  if (Object.keys(updates).length === 0) return profile;
  try {
    await updateDoc(doc(db, "users", uid), updates);
    return {
      ...profile,
      name: (updates.name as string) ?? profile.name,
      email: (updates.email as string) ?? profile.email,
    };
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
    if (p) setCachedProfile(p.uid, p);
    // Auth hint is managed separately in onAuthStateChanged / signOut —
    // NOT here, so Firestore errors or missing profiles can't accidentally
    // flip the hint and cause a "logged out" flash for a real user.
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
        setAuthHint(false); // clear auth hint — Firebase confirmed signed out
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

      // Set auth hint IMMEDIATELY — before any Firestore fetch.
      // This is the earliest possible moment we know the user is authenticated.
      // On the next session open, AppShell reads this flag synchronously and
      // shows the authenticated layout with zero delay.
      setAuthHint(true);
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

        // Skip background re-fetch if cache was written < 5 min ago — saves 1 Firestore
        // read per page load for actively navigating users. Firebase Auth only fires
        // onAuthStateChanged once per hard page load (not per SPA navigation), so this
        // only skips re-fetches when the user hard-refreshes within a short window.
        if (isProfileCacheFresh(firebaseUser.uid)) return;

        // Verify with Firestore in background (non-blocking)
        fetchProfile(firebaseUser.uid).then(async result => {
          if (!mounted) return;
          if (result.status === "found") {
            const patched = await patchProfileFromFirebase(firebaseUser.uid, firebaseUser, result.profile);
            if (!mounted) return;
            applyProfile(patched);
            // Run streak check — pass already-fetched extras to avoid an extra getDoc.
            // Only re-fetch profile if the check actually wrote changes (streak reset).
            checkAndBreakStreak(firebaseUser.uid, result.extras).then(async (changed) => {
              if (!changed || !mounted) return;
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

        // Streak check runs in background after content is visible.
        // Pass already-fetched extras — no extra getDoc needed.
        // Only re-fetch if the check actually wrote updates (streak/today reset).
        checkAndBreakStreak(firebaseUser.uid, result.extras).then(async (changed) => {
          if (!changed || !mounted) return;
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
      // Use redirect-based sign-in — more reliable in proxied/iframe environments
      // (popup-based auth can silently fail when the popup can't communicate back
      // to a parent window across cross-origin iframe boundaries).
      await signInWithRedirect(auth, googleProvider);
      return { outcome: "redirect", isNewUser: false };
    } catch (err: unknown) {
      setLoading(false);
      const code = (err as { code?: string })?.code ?? "unknown";
      if (code === "auth/cancelled-popup-request" || code === "auth/popup-closed-by-user") {
        return { outcome: "cancelled", isNewUser: false };
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAuthHint(false); // clear auth hint on explicit logout
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
