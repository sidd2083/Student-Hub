import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Aggressive cache-busting: each chunk gets a content hash
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          // React core — loaded first, always cached
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/scheduler/")) {
            return "vendor-react";
          }
          // Firebase — split so auth (small, critical) loads before firestore (huge)
          if (id.includes("node_modules/@firebase/firestore") || id.includes("node_modules/firebase/firestore")) {
            return "vendor-firebase-firestore";
          }
          if (id.includes("node_modules/@firebase/auth") || id.includes("node_modules/firebase/auth")) {
            return "vendor-firebase-auth";
          }
          if (id.includes("node_modules/@firebase/storage") || id.includes("node_modules/firebase/storage")) {
            return "vendor-firebase-storage";
          }
          if (id.includes("node_modules/@firebase/") || id.includes("node_modules/firebase/")) {
            return "vendor-firebase-core";
          }
          // UI icons — large, but only needed after first paint
          if (id.includes("node_modules/lucide-react/") || id.includes("node_modules/react-icons/")) {
            return "vendor-icons";
          }
          // Animation — only loaded on pages that use it
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-motion";
          }
          // Radix primitives
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }
          // Router + data fetching
          if (id.includes("node_modules/wouter/") || id.includes("node_modules/@tanstack/")) {
            return "vendor-router";
          }
          // Charts (heavy, only on report/leaderboard pages)
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-")) {
            return "vendor-charts";
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/pages/Home.tsx",
        "./src/pages/Dashboard.tsx",
        "./src/pages/DailyMissions.tsx",
        "./src/pages/Notes.tsx",
        "./src/pages/Pomodoro.tsx",
        "./src/components/Layout.tsx",
        "./src/components/AppShell.tsx",
        "./src/context/AuthContext.tsx",
        "./src/lib/firebase.ts",
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        proxyTimeout: 120_000,
        timeout: 120_000,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
