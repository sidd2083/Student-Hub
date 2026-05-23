import React from "react";
import { renderToString } from "react-dom/server";
import { HelmetProvider, type FilledContext } from "react-helmet-async";
import { Router } from "wouter";

// A minimal static location hook that never touches window/useSyncExternalStore.
// Wouter uses this hook shape: () => [path, navigate], with optional .searchHook.
function createStaticLocation(path: string) {
  const navigate = () => {};
  const hook = () => [path, navigate] as const;
  hook.searchHook = () => "";
  return hook;
}

const PAGE_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "/tools/gpa-calculator": () => import("./pages/GpaCalculator"),
  "/tools/attendance-calculator": () => import("./pages/AttendanceCalculator"),
};

export async function render(url: string): Promise<{ appHtml: string; headTags: string } | null> {
  const loader = PAGE_LOADERS[url];
  if (!loader) return null;

  const { default: Component } = await loader();
  const helmetContext: Partial<FilledContext> = {};

  const appHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <Router hook={createStaticLocation(url)}>
        <Component />
      </Router>
    </HelmetProvider>
  );

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

  return { appHtml, headTags };
}
