---
name: Photo Upload Fix
description: Why Firebase Storage client SDK is skipped in photoUpload.ts
---

## The Rule
When backend `/api/upload/avatar` returns 503 (no FIREBASE_SERVICE_ACCOUNT_JSON), skip Firebase Storage client SDK entirely and go directly to Firestore data-URL fallback.

**Why:** Firebase Storage client SDK has CORS failures on Replit's `*.replit.dev` proxy domain. The domain isn't whitelisted in Firebase Storage CORS config. Result was "avatar can't upload" error.

## The Fallback Chain (after fix)
1. POST `/api/upload/avatar` (Admin SDK — requires FIREBASE_SERVICE_ACCOUNT_JSON) → if 503, skip to 2
2. ~~Firebase Storage client SDK~~ (REMOVED — CORS fails on Replit)  
3. Firestore data-URL: compress to 220px JPEG (~10-20KB), store in `users/{uid}.photoURL` — always works if authenticated

## How to Apply
Any future avatar upload changes: do NOT re-introduce the Firebase Storage client SDK path unless CORS is explicitly configured for the Replit domain in Firebase Console.
