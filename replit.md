# Student Hub

## Overview

Public-first, SEO-optimized study platform for Grade 9–12 students in Nepal. Clean white minimal mobile-app-like UI.

## Features

### Public (no login required)
- **Home** `/` — Public landing page with hero, features grid, notes/PYQs preview, mobile bottom nav
- **Notes** `/notes` — Browse by grade/subject/chapter; login CTA banner for guests
- **PYQs** `/pyqs` — Previous year exam papers; login CTA for guests
- **NotePage** `/notes/:id` — SEO-optimized individual note page with Helmet meta tags
- **PyqPage** `/pyq/:id` — SEO-optimized individual PYQ page with Helmet meta tags
- **About** `/about` — Static about page
- **Contact** `/contact` — Static contact page

### Soft-Gated (browsable by all, blur overlay + login CTA for guests)
- **MCQ Practice** `/mcq` — Practice questions by grade/subject/difficulty; score submission
- **Nep AI** `/ai` — AI study assistant (OpenAI via Replit integration)
- **Pomodoro** `/pomodoro` — 25/50/custom min focus timer linked to tasks
- **To-Do** `/todo` — Task management with completion tracking
- **Leaderboard** `/leaderboard` — Daily and all-time MCQ scores

### Private (require login — redirect to `/` if not authenticated)
- **Dashboard** `/dashboard` — Greeting, stats (streak/rank/tasks), announcements, quick access
- **Settings** `/settings` — Profile management

### Admin
- **AdminLogin** `/admin` — Hardcoded credentials
- **Admin Panel** `/admin/dashboard` — Full CRUD for notes, MCQs, PYQs, users, leaderboard; SEO panel

## Auth Routing Logic

- Guest visiting `/` → stays on Home page
- Guest visiting `/notes`, `/pyqs`, `/notes/:id`, `/pyq/:id`, `/about`, `/contact` → allowed (public)
- Guest visiting `/mcq`, `/ai`, `/todo`, `/pomodoro`, `/leaderboard` → allowed (soft-gated with blur overlay)
- Guest visiting `/dashboard`, `/settings` → redirected to `/`
- Logged-in user visiting `/` or `/login` → redirected to `/dashboard`
- New user (no Firestore profile) → redirected to `/setup-profile`

## Layout Architecture

**AppShell** (`src/components/AppShell.tsx`) is the single layout selector:
- Guest (not logged in) → `PublicLayout` (sticky header + footer, no sidebar)
- Logged in → `Layout` / Dashboard layout (sidebar on desktop, bottom nav on mobile, NO header)
- Admin routes (`/admin`, `/admin/dashboard`) → completely independent, no layout
- Standalone routes (`/login`, `/setup-profile`, `/onboarding`) → no layout

**PublicLayout** header nav: Home, Notes, PYQ, About, Contact + Register button
**Dashboard Layout** sidebar: Dashboard, Notes, PYQ, Nep AI, Pomodoro, To-do, MCQ, Leaderboard
**Dashboard Layout** mobile bottom nav: Home, Notes, PYQ, Tools, Profile

Pages do NOT import or render Layout/PublicLayout directly — AppShell handles it.

## Key Components

- `src/components/AppShell.tsx` — Auth-aware layout selector (public vs dashboard)
- `src/components/SoftGate.tsx` — Blur overlay + Google login CTA for gated features
- `src/components/Layout.tsx` — Dashboard layout: left sidebar (desktop) + bottom nav (mobile), logged-in only
- `src/components/PublicLayout.tsx` — Public layout: sticky header with Register button + footer
- `src/context/AuthContext.tsx` — Firebase auth with public path regex including soft-gate routes
- `src/pages/Home.tsx` — Public landing page content (no inline header/footer)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind v4), wouter v3
- **Auth**: Firebase (Google Sign-In + Firestore for profiles)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI**: OpenAI via Replit AI Integration (AI_INTEGRATIONS_OPENAI_BASE_URL)
- **SEO**: react-helmet-async on all pages
- **Build**: esbuild

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Artifacts

- `artifacts/student-hub` — React+Vite frontend (port 22581, path `/`)
- `artifacts/api-server` — Express API (port 8080, path `/api`)

## Key Files

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/src/generated/api.ts` — generated hooks
- `lib/db/src/schema/` — Drizzle schema files
- `artifacts/student-hub/src/App.tsx` — routing hub
- `artifacts/student-hub/src/context/AuthContext.tsx` — Firebase auth + path allowlist
- `artifacts/api-server/src/routes/` — all API routes

## DB Schema

Tables: `users`, `notes`, `mcqs`, `pyqs`, `tasks`, `scores`

## Notes

- Firebase env vars not set in dev → firebase.ts uses stub objects (warns to console), app stays functional
- `lib/api-zod/src/index.ts` must stay as `export {};` (zod schemas config removed from orval due to duplicate export issue)
- Mutations from orval wrap body in `{ data: ... }` (e.g., `createUser.mutate({ data: { ... } })`)
- Admin role is set per-user in the `users` table (`role: "admin"`)
- wouter v3: `Link` renders as `<a>` directly — do NOT nest `<a>` inside `Link`
- `useGetNote(id, options)` — id as first arg directly
- `useListPyqs({}, options)` — fetch all then find by id in PyqPage
