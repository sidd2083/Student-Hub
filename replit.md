# Student Hub

A study platform for high-school students (grades 9–12) in Nepal, featuring notes, PYQs, MCQ practice, a Pomodoro timer, task tracking, a leaderboard, and an AI study assistant ("Nep AI").

## Run & Operate

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/student-hub run dev` | Run frontend dev server |
| `pnpm --filter @workspace/student-hub run build` | Build frontend for production |

**Workflows (managed by Replit):**
- `Start application` — Frontend Vite dev server on port 5000

**Required env vars (Replit userenv / Vercel environment variables):**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_OPENAI_API_KEY` — for Nep AI chat (falls back to local answers if not set)
- `VITE_OPENAI_BASE_URL` — optional, defaults to `https://api.openai.com/v1`

**No backend, no DATABASE_URL, no Express server needed.** Everything runs in the browser via Firebase.

## Stack

- **Frontend:** React 19 + Vite 7, Wouter (routing), TanStack Query, Tailwind CSS v4, Radix UI, Framer Motion
- **Auth:** Firebase Auth (Google Sign-In)
- **Database:** Firestore (all user data, tasks, study logs, announcements)
- **AI:** OpenAI `gpt-4o-mini` called directly from the browser via `VITE_OPENAI_API_KEY`
- **Monorepo:** pnpm workspaces

## Architecture

This is a **pure frontend app** — no Express backend, no PostgreSQL. All data lives in Firestore.

### Firestore collections

| Collection | What's stored |
|---|---|
| `users/{uid}` | Profile (name, email, grade, role), streak, totalStudyTime, todayStudyTime, lastActiveDate, badges |
| `tasks/{docId}` | Per-user to-do tasks (uid, text, completed, createdAt) |
| `study_logs/{uid_date}` | Daily study logs (studyMinutes, tasksCompleted, notesViewed) |
| `announcements/{docId}` | Admin-posted announcements shown on Dashboard |

### How each feature works

- **Auth** — Firebase Auth Google Sign-In → profile stored in `users/{uid}`
- **Onboarding** — `setDoc` to `users/{uid}` with name + grade
- **Pomodoro** — `updateDoc` on `users/{uid}` and `study_logs` directly from `TimerContext`
- **Tasks / To-Do** — CRUD on `tasks` collection
- **Leaderboard** — reads all docs from `users` collection, sorts in browser
- **Report Card** — reads `users/{uid}` + `study_logs` collection
- **Nep AI** — `fetch` directly to OpenAI API using `VITE_OPENAI_API_KEY`; graceful fallback to local answers if key is missing
- **Dashboard** — reads `users/{uid}`, `tasks`, `study_logs`, `announcements`

## Vercel deployment

`vercel.json` is already configured. Deploy steps:
1. Push this repo to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Set all `VITE_*` environment variables in Vercel dashboard
4. Deploy — no DATABASE_URL needed, no backend

## Where things live

```
artifacts/student-hub/  — React frontend (src/)
  src/pages/            — All pages (Dashboard, Todo, Pomodoro, NepAi, Leaderboard, ReportCard, …)
  src/context/          — AuthContext (Firebase Auth + Firestore), TimerContext (Pomodoro + Firestore)
  src/lib/firebase.ts   — Firebase SDK init
artifacts/api-server/   — Legacy Express backend (kept for reference, NOT deployed to Vercel)
```

## User preferences

_None recorded yet._

## Gotchas

- `pnpm-workspace.yaml` enforces a 1-day minimum package age for supply-chain safety — do not disable `minimumReleaseAge`.
- Firebase is gracefully degraded when env vars are missing (warns in console, stubs auth/db).
- Nep AI gracefully falls back to local pre-written answers if `VITE_OPENAI_API_KEY` is not set.
- The Backend API workflow on Replit is no longer needed by the frontend; it can be ignored.
- Pre-existing TS warning in `SiteGuide.tsx` (TS7030) is harmless — Vite builds successfully.
