---
name: Photo Upload Fix
description: Why Firebase Storage client SDK is skipped and how the Firestore data-URL fallback works.
---

## The Rule
When backend `/api/upload/avatar` returns any 5xx error or 401/403, the frontend falls through to the Firestore data-URL fallback. The backend now explicitly returns **503** (not 500) when `db` (Admin SDK) is null, so the fallback always triggers correctly.

**Why:** Firebase Admin SDK is not initialized on Replit (no FIREBASE_SERVICE_ACCOUNT_JSON). Previously the backend would sometimes return 500 from an exception in the Storage call instead of 503, which the frontend treated as a hard error and showed "Avatar upload failed." Fixed by:
1. Backend: check `!db` in avatar route → return 503 immediately
2. Frontend: fall through to Firestore for **all 5xx errors** (not just 503)

## The Fallback Chain
1. POST `/api/upload/avatar` (Admin SDK — requires FIREBASE_SERVICE_ACCOUNT_JSON) → if 5xx/401/403, go to 2
2. ~~Firebase Storage client SDK~~ (REMOVED — CORS fails on Replit)  
3. Firestore data-URL: compress to 220px JPEG (~10-20KB), `setDoc({merge:true})` on `users/{uid}.photoURL` — always works if authenticated

## How to Apply
- Frontend `photoUpload.ts`: fallthrough condition is `res.status >= 400 && res.status < 500 && status !== 401 && status !== 403`
- Backend `upload.ts` avatar route: gate on `!storage || !STORAGE_BUCKET || !db` → return 503
- Do NOT re-introduce Firebase Storage client SDK path unless CORS is configured for the Replit/custom domain
