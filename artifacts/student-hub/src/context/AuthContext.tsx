import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  grade: number;
  role: "user" | "admin";
  createdAt: string;
}

interface ReplitUser {
  id: string;
  name: string;
  profileImage: string;
}

interface AuthContextType {
  user: ReplitUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  setProfile: (p: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function fetchReplitUser(): Promise<ReplitUser | null> {
  try {
    const res = await fetch("/api/auth/user");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchProfile(uid: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`/api/users/${uid}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ReplitUser | null>(null);
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = useCallback((p: UserProfile | null) => {
    setProfileState(p);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const replitUser = await fetchReplitUser();
      if (!mounted) return;

      if (!replitUser) {
        setUser(null);
        applyProfile(null);
        setLoading(false);
        return;
      }

      setUser(replitUser);
      const prof = await fetchProfile(replitUser.id);
      if (!mounted) return;

      applyProfile(prof);
      setLoading(false);

      if (!prof) {
        const path = window.location.pathname;
        const safePages = ["/setup-profile", "/onboarding"];
        if (!safePages.some(p => path.startsWith(p))) {
          window.location.replace("/setup-profile");
        }
      } else {
        const path = window.location.pathname;
        if (path === "/" || path === "/login") {
          window.location.replace("/dashboard");
        }
      }
    })();
    return () => { mounted = false; };
  }, [applyProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const prof = await fetchProfile(user.id);
    applyProfile(prof);
  }, [user, applyProfile]);

  const setProfile = useCallback((p: UserProfile | null) => {
    applyProfile(p);
  }, [applyProfile]);

  const signIn = () => {
    window.location.href = "/api/auth/login";
  };

  const signOut = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
