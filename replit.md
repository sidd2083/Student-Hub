# Student Hub

A study platform for high-school students (grades 9–12) in Nepal, featuring notes, PYQs, MCQ practice, a Pomodoro timer, task tracking, a leaderboard, and an AI study assistant ("Nep AI").

## Run & Operate

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/api-server run build` | Build the backend |
| `pnpm --filter @workspace/db run push` | Push DB schema (uses `DATABASE_URL`) |
| `pnpm --filter @workspace/student-hub run dev` | Run frontend dev server |

**Workflows (managed by Replit):**
- `Start application` — Frontend Vite dev server on port 22581 (`PORT=22581 BASE_PATH=/`)
- `Backend API` — Express API server on port 8080 (runs pre-built `dist/index.mjs`)

**Required env vars:** `DATABASE_URL` (auto-provisioned by Replit PostgreSQL)

**Optional secrets:** `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` (set via Replit AI Integrations for Nep AI chat)

**Firebase env vars (in `.replit` userenv):** `VITE_FIREBASE_*` — already configured for the `studenthub-6bcc5` project.

## Stack

- **Frontend:** React 19 + Vite 7, Wouter (routing), TanStack Query, Tailwind CSS v4, Radix UI, Framer Motion
- **Backend:** Express v5, TypeScript (ESM, bundled via esbuild)
- **Database:** PostgreSQL via Drizzle ORM + `pg`
- **Auth:** Firebase Auth (Google Sign-In) + Firestore for user profiles
- **AI:** OpenAI SDK (`gpt-4o-mini`) via Replit AI Integrations
- **Monorepo:** pnpm workspaces

## Where things live

```
artifacts/api-server/   — Express backend (src/, build.mjs, dist/)
artifacts/student-hub/  — React frontend (src/)
lib/db/                 — Drizzle schema + pg pool (source of truth for DB)
lib/api-spec/           — OpenAPI spec (openapi.yaml)
lib/api-client-react/   — Generated React Query hooks from OpenAPI
lib/api-zod/            — Shared Zod schemas
```

- DB schema: `lib/db/src/schema/`
- API contract: `lib/api-spec/openapi.yaml`
- Drizzle config: `lib/db/drizzle.config.ts`
- Vite config: `artifacts/student-hub/vite.config.ts`

## Architecture decisions

- **Monorepo with pnpm workspaces** — shared code (DB schema, Zod, generated API client) lives in `lib/*` and is referenced as `workspace:*` dependencies.
- **Backend pre-built before serving** — the Backend API workflow runs the pre-built `dist/index.mjs`; the `dev` script in `api-server` builds then starts. Rebuild after backend changes.
- **Vite proxies `/api` to port 8080** — frontend calls relative `/api/*` URLs; Vite dev server forwards them to the Express backend.
- **Firebase stays as-is** — the app uses Firebase Auth (Google Sign-In) and Firestore for user profiles. Firebase config is in `.replit` `[userenv.shared]` so it's available in both dev and deployed environments.
- **OpenAI via Replit AI Integrations** — the AI chat endpoint reads `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` so it works without a personal API key.

## Product

- **Notes** — create, browse, and share study notes
- **PYQs** — past-year question browser
- **MCQ Practice** — multiple-choice quiz practice
- **Pomodoro** — focus timer
- **Tasks / To-Do** — task tracking with streaks
- **Leaderboard** — student ranking
- **Nep AI** — AI study assistant (calls `POST /api/ai/chat`)
- **Admin panel** — standalone admin interface at `/admin/*`

## User preferences

_None recorded yet._

## Gotchas

- Always rebuild the backend (`pnpm --filter @workspace/api-server run build`) before restarting the Backend API workflow after TypeScript changes.
- The `PORT` and `BASE_PATH` env vars are required by the Vite config — they are set in the workflow command, not as secrets.
- `pnpm-workspace.yaml` enforces a 1-day minimum package age for supply-chain safety — do not disable `minimumReleaseAge`.
- Firebase is gracefully degraded when env vars are missing (warns in console, stubs auth/db) — but the real Firebase config is already set in `.replit` userenv.
- **Firestore user fields** — canonical field names: `totalStudyTime` (all-time minutes), `todayStudyTime` (today's minutes, resets when date changes), `lastActiveDate` (YYYY-MM-DD), `streak` (days). Old docs may have `studyTime` — always read with `?? v.studyTime ?? 0` fallback.
- **Daily report** — generated client-side in `Pomodoro.tsx → generateDailyReport()` when a session ends after 10 PM. Stored in `reports/{uid}_{YYYY-MM-DD}`.
- `lib/api-client-react/dist/index.d.ts` not pre-built — pre-existing TS6305 errors from `tsc --noEmit` are harmless; Vite resolves workspace packages at runtime correctly.

## Pointers

- [Drizzle ORM docs](https://orm.drizzle.team/)
- [TanStack Query docs](https://tanstack.com/query/latest)
- [Vite proxy config](https://vite.dev/config/server-options.html#server-proxy)
- Replit skills: `database`, `environment-secrets`, `workflows`, `integrations`
