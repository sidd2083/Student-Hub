# Student Hub

A Firebase-backed React+Vite study platform for Grade 9–12 students in Nepal. Features study notes, past exam papers (PYQ), Nep AI assistant, Pomodoro timer with Firestore study-time tracking, streak system, Report Card analytics, and a Firestore-based leaderboard.

## Run & Operate

```bash
# Install all dependencies
pnpm install

# Start dev server (PORT and BASE_PATH required)
PORT=22581 BASE_PATH=/ pnpm --filter @workspace/student-hub run dev

# Build for production
pnpm --filter @workspace/student-hub run build
```

Required env vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`

## Stack

- **Frontend**: React 18 + Vite 7, TypeScript, Tailwind CSS v4, shadcn/ui
- **Routing**: wouter
- **State**: TanStack Query
- **Backend API**: Express (packages/api-server) + Drizzle ORM + PostgreSQL (for Notes, PYQs, Tasks)
- **Auth & Realtime DB**: Firebase Auth (Google sign-in) + Firestore
- **Storage**: Firebase Storage (for note/PYQ file uploads)

## Where things live

- `artifacts/student-hub/src/` — React app source
- `artifacts/student-hub/src/pages/` — all page components
- `artifacts/student-hub/src/components/` — Layout, PublicLayout, SoftGate, ProtectedRoute, AppShell
- `artifacts/student-hub/src/context/AuthContext.tsx` — Firebase auth + Firestore profile check + redirect logic
- `artifacts/student-hub/src/lib/firebase.ts` — Firebase init (reads VITE_FIREBASE_* env vars)
- `packages/api-server/` — Express backend (Notes, PYQs, Tasks, TODO routes)
- `packages/api-client-react/` — TanStack Query hooks auto-generated from OpenAPI spec

## Architecture decisions

- **MCQ system fully removed** — no MCQ routes, pages, admin sections, or API calls remain in the frontend. `McqPractice.tsx` file still exists but has no active route.
- **Firestore for user data** — streak, studyTime, lastActive, grade, role all live in `users/{uid}`. Study logs in `users/{uid}/studyLogs/{date}` (date = YYYY-MM-DD).
- **Pomodoro saves to Firestore** — on session completion, increments `users/{uid}.studyTime` and upserts `users/{uid}/studyLogs/{date}.studyMinutes`.
- **Leaderboard is Firestore-based** — reads `users` collection, sorts by studyTime or streak, no API dependency.
- **SoftGate pattern** — unauthenticated users can visit tool pages and see a blur overlay prompting Google sign-in.
- **Streak auto-updates on dashboard load** — compares `lastActive` to today/yesterday and increments in Firestore.

## Product

- Public: Home, Notes list, Note viewer, PYQ list, PYQ viewer, About, Contact
- Auth-required: Dashboard, Report Card (/report), Pomodoro, To-Do, Nep AI, Leaderboard, Settings
- Admin (/admin): Manage Notes, PYQs, Announcements, Users, Study Reports (Firestore), SEO Panel

## User preferences

- Nepal students Grade 9–12 audience
- Firebase-first for user data (not PostgreSQL)
- No MCQ system — removed completely
- Report Card replaces MCQ throughout navigation and admin

## Gotchas

- Vite config throws if `PORT` or `BASE_PATH` env vars are missing — always pass them in the workflow command
- `pnpm install` must be run from the workspace root (not artifact subfolder)
- Firebase Storage `ref/uploadBytesResumable` used in Admin for file uploads
- The `useListNotes` / `useListPyqs` hooks return data via TanStack Query — always guard with `Array.isArray()` before calling `.slice()/.map()`

## Pointers

- Firebase console: https://console.firebase.google.com
- Firestore collections: `users`, `users/{uid}/studyLogs`, `announcements`, `notes` (legacy), `pyqs` (legacy), `seo_meta`
