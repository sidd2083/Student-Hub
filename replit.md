# Student Hub

## Overview

Full-stack web app for high school students (grades 9-12). Clean white minimal UI (Instagram-style).

## Features
- Google Sign-In via Firebase Auth
- Notes — study materials by grade/subject/chapter (text, PDF, image)
- MCQ Practice — configurable quizzes with difficulty filtering and scoring
- PYQs — previous year exam papers (PDF links)
- To-Do — task management with completion tracking
- Pomodoro Timer — 25/50 min focus sessions, linked to tasks
- Nep AI — AI study assistant powered by OpenAI (via Replit integration)
- Leaderboard — daily and all-time MCQ scores
- Admin Panel — full CRUD for notes, MCQs, PYQs, users, leaderboard control

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind v4)
- **Auth**: Firebase (Google Sign-In)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **AI**: OpenAI via Replit AI Integration (AI_INTEGRATIONS_OPENAI_BASE_URL)
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
- `artifacts/student-hub/src/App.tsx` — routing
- `artifacts/student-hub/src/context/AuthContext.tsx` — Firebase auth
- `artifacts/api-server/src/routes/` — all API routes

## DB Schema

Tables: `users`, `notes`, `mcqs`, `pyqs`, `tasks`, `scores`

## Notes

- `lib/api-zod/src/index.ts` must stay as `export {};` (zod schemas config removed from orval due to duplicate export issue)
- Mutations from orval wrap body in `{ data: ... }` (e.g., `createUser.mutate({ data: { ... } })`)
- Admin role is set per-user in the `users` table (`role: "admin"`)
