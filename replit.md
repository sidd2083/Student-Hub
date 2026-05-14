# Student Hub

A study platform for high-school students (grades 9–12) in Nepal, featuring notes, PYQs, MCQ practice, a Pomodoro timer, task tracking, a leaderboard, and an AI study assistant ("Nep AI").

## Run & Operate

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/student-hub run dev` | Run frontend dev server |
| `pnpm --filter @workspace/student-hub run build` | Build frontend for production |
| `pnpm --filter @workspace/api-server run build` | Build Express backend |

**Workflows (managed by Replit):**
- `Start application` — Frontend Vite dev server on port 5000
- `Backend API` — Express API server on port 8080 (proxied by Vite in dev)

**Frontend env vars (all VITE_* — needed by both Replit and Vercel):**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

**Backend env vars (Express api-server — for Replit and Vercel):**
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Admin SDK credentials (JSON string of service account key). Required for api-server to read/write Firestore. Get it from Firebase Console → Project Settings → Service Accounts → Generate new private key.
- `FIREBASE_PROJECT_ID` — fallback if no service account (limited functionality)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — set automatically by Replit AI integration
- `OPENAI_API_KEY` — set this on Vercel (used by `/api/ai/chat` when the Replit integration key isn't present)
- `OPENAI_BASE_URL` — optional OpenAI base URL override on Vercel

## Stack

- **Frontend:** React 19 + Vite 7, Wouter (routing), TanStack Query, Tailwind CSS v4, Radix UI, Framer Motion
- **Auth:** Firebase Auth (Google Sign-In)
- **Database:** Firestore (all user data — `users`, `tasks`, `study_logs`, `announcements`, `notes`, `pyqs`, `mcqs`)
- **AI:** `/api/ai/chat` proxied through Express backend → Gemini `gemini-2.5-flash`
- **Monorepo:** pnpm workspaces

## Architecture

The frontend uses Firestore directly for all data. The Express api-server uses Firebase Admin SDK (no PostgreSQL) and provides REST routes that mirror the same Firestore collections, plus the `/api/ai/chat` route for Nep AI.

### Firestore collections

| Collection | What's stored |
|---|---|
| `users/{uid}` | Profile (name, email, grade, role), streak, totalStudyTime, todayStudyTime, lastActiveDate, badges |
| `tasks/{docId}` | Per-user to-do tasks (uid, text, completed, createdAt) |
| `study_logs/{uid_date}` | Daily study logs (studyMinutes, tasksCompleted, notesViewed) |
| `announcements/{docId}` | Admin-posted announcements shown on Dashboard |
| `notes/{docId}` | Study notes (grade, subject, chapter, title, contentType, content) |
| `pyqs/{docId}` | Past year questions (grade, subject, title, year, pdfUrl, fileType) |
| `mcqs/{docId}` | MCQ practice questions (grade, subject, chapter, question, options, answer) |

### How each feature works

- **Auth** — Firebase Auth Google Sign-In → profile stored in `users/{uid}`
- **Onboarding** — `setDoc` to `users/{uid}` with name + grade
- **Pomodoro** — `updateDoc` on `users/{uid}` and `study_logs` directly from `TimerContext`
- **Tasks / To-Do** — CRUD on `tasks` collection directly from browser
- **Leaderboard** — reads all docs from `users` collection, sorts in browser
- **Report Card** — reads `users/{uid}` + `study_logs` collection
- **Nep AI** — frontend calls `/api/ai/chat` (proxied to Express in dev); Express calls OpenAI via `AI_INTEGRATIONS_OPENAI_API_KEY` (Replit) or `OPENAI_API_KEY` (Vercel)
- **Notes/PYQs/MCQs** — CRUD via Admin page, reads via Notes/PYQ/MCQ pages, all in Firestore
- **Dashboard** — reads `users/{uid}`, `tasks`, `study_logs`, `announcements`

## Vercel deployment

`vercel.json` is configured to:
1. Build the React frontend
2. Route `/api/*` requests to the Express handler (`api/index.ts` → `artifacts/api-server/src/handler.ts`)
3. Route everything else to `index.html` (SPA)

**Deploy steps:**
1. Push this repo to GitHub
2. Import in [vercel.com](https://vercel.com)
3. Set all `VITE_*` environment variables in Vercel dashboard
4. Set `FIREBASE_SERVICE_ACCOUNT_JSON` (service account key JSON, as a single-line string)
5. Set `OPENAI_API_KEY` for Nep AI
6. Deploy — **no DATABASE_URL needed**

## Where things live

```
artifacts/student-hub/  — React frontend (src/)
  src/pages/            — All pages (Dashboard, Todo, Pomodoro, NepAi, Leaderboard, ReportCard, …)
  src/context/          — AuthContext (Firebase Auth + Firestore), TimerContext (Pomodoro + Firestore)
  src/lib/firebase.ts   — Firebase SDK init
artifacts/api-server/   — Express backend (no PostgreSQL — uses Firebase Admin SDK)
  src/lib/firestore-admin.ts — Firebase Admin init (uses FIREBASE_SERVICE_ACCOUNT_JSON)
  src/routes/           — All REST routes (users, notes, pyqs, mcqs, tasks, scores, study, ai)
api/index.ts            — Vercel serverless function entry point (re-exports Express app)
```

## User preferences

_None recorded yet._

## Gotchas

- `pnpm-workspace.yaml` enforces a 1-day minimum package age for supply-chain safety — do not disable `minimumReleaseAge`.
- Firebase client SDK is gracefully degraded when env vars are missing (warns in console, stubs auth/db).
- Firebase Admin SDK (api-server) requires `FIREBASE_SERVICE_ACCOUNT_JSON` on Vercel; falls back to `FIREBASE_PROJECT_ID` with limited functionality.
- Nep AI calls `/api/ai/chat` (Express proxy) — not OpenAI directly from the browser.
- The Express api-server uses Firebase Admin SDK for all data — **no PostgreSQL, no DATABASE_URL needed**.
- Pre-existing TS warning in `SiteGuide.tsx` (TS7030) is harmless — Vite builds successfully.
