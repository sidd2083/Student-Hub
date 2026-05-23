import React, { createContext, useContext } from "react";
import { renderToString } from "react-dom/server";
import { HelmetProvider, type FilledContext } from "react-helmet-async";
import { Router } from "wouter";
import { AuthContext } from "./context/AuthContext";

// A minimal static location hook that never touches window/useSyncExternalStore.
function createStaticLocation(path: string) {
  const navigate = () => {};
  const hook = () => [path, navigate] as const;
  hook.searchHook = () => "";
  return hook;
}

// Mock AuthProvider — provides null user/profile so pages that call useAuth()
// can render their logged-out state at build time without Firebase being available.
function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const mockValue = {
    user: null,
    profile: null,
    loading: false,
    signInWithGoogle: async () => ({ outcome: "cancelled" as const, isNewUser: false }),
    signOut: async () => {},
    refreshProfile: async () => {},
    setProfile: () => {},
  };
  return (
    <AuthContext.Provider value={mockValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Page registry ─────────────────────────────────────────────────────────────
const STATIC_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "/tools/gpa-calculator":        () => import("./pages/GpaCalculator"),
  "/tools/attendance-calculator": () => import("./pages/AttendanceCalculator"),
  "/tools":                       () => import("./pages/Tools"),
  "/about":                       () => import("./pages/About"),
  "/contact":                     () => import("./pages/Contact"),
  "/privacy-policy":              () => import("./pages/PrivacyPolicy"),
  "/terms":                       () => import("./pages/Terms"),
};

// Dynamic pages — need the mock AuthProvider so useAuth() doesn't throw.
// These render in "logged-out" mode, showing public content for Google.
const DYNAMIC_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "/notes": () => import("./pages/Notes"),
  "/pyqs":  () => import("./pages/Pyqs"),
  "/mcq":   () => import("./pages/McqPractice"),
};

export async function render(url: string): Promise<{ appHtml: string; headTags: string; needsAuth: boolean } | null> {
  const staticLoader = STATIC_LOADERS[url];
  const dynamicLoader = DYNAMIC_LOADERS[url];
  const loader = staticLoader ?? dynamicLoader;
  if (!loader) return null;

  const { default: Component } = await loader();
  const helmetContext: Partial<FilledContext> = {};
  const needsAuth = Boolean(dynamicLoader);

  const tree = (
    <HelmetProvider context={helmetContext}>
      <Router hook={createStaticLocation(url)}>
        {needsAuth ? (
          <MockAuthProvider>
            <Component />
          </MockAuthProvider>
        ) : (
          <Component />
        )}
      </Router>
    </HelmetProvider>
  );

  const appHtml = renderToString(tree);

  const ctx = helmetContext as FilledContext;
  const { helmet } = ctx;

  const headTags = [
    helmet?.title?.toString() ?? "",
    helmet?.meta?.toString() ?? "",
    helmet?.link?.toString() ?? "",
    helmet?.script?.toString() ?? "",
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n    ");

  return { appHtml, headTags, needsAuth };
}
