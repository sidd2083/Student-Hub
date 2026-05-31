import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger";
import { getAdminStorage, getAdminDb } from "../lib/firebase-admin";
import { requireAuth } from "../lib/auth-middleware";
import { triggerSitemapRefresh } from "./sitemap";
import crypto from "crypto";

const router = Router();

// 5 MB max — per security spec
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const STORAGE_BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET;

// Only safe, non-executable image formats + PDF.
// GIF, HEIC, HEIF, SVG, BMP deliberately excluded:
//   - SVG can embed JavaScript (XSS vector)
//   - GIF/HEIC/HEIF not needed and increase attack surface
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// Folders that require admin role
const ADMIN_ONLY_FOLDERS = new Set(["notes", "pyqs", "uploads"]);

// Validate folder to an allow-list (prevent path traversal / arbitrary writes)
function sanitizeFolder(raw: unknown): string {
  if (typeof raw !== "string") return "uploads";
  return raw.replace(/[^a-z0-9_-]/gi, "").slice(0, 50) || "uploads";
}

router.post(
  "/upload",
  requireAuth,
  multerUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided." });

      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only PDF and image files are allowed." });
      }

      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ error: "File exceeds the 5 MB size limit." });
      }

      const folder = sanitizeFolder(req.body?.folder);

      // Admin-only folders require the caller to be an admin
      if (ADMIN_ONLY_FOLDERS.has(folder)) {
        const db = getAdminDb();
        if (!db) {
          return res.status(503).json({
            error: "Admin verification unavailable — FIREBASE_SERVICE_ACCOUNT_JSON not set.",
          });
        }
        const userSnap = await db.collection("users").doc(req.uid!).get();
        if (!userSnap.exists || userSnap.data()?.role !== "admin") {
          logger.warn({ uid: req.uid, folder }, "[Upload] Non-admin attempted admin folder upload");
          return res.status(403).json({ error: "Forbidden: only admins can upload to this folder." });
        }
      }

      const ext  = (file.originalname.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase();
      const path = `${folder}/${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;

      // ── Firebase Admin SDK (bypasses Storage rules — preferred path) ─────────
      const storage = getAdminStorage();
      if (storage && STORAGE_BUCKET) {
        const bucket  = storage.bucket(STORAGE_BUCKET);
        const fileRef = bucket.file(path);
        const token   = crypto.randomUUID();

        await fileRef.save(file.buffer, {
          contentType: file.mimetype,
          metadata: { firebaseStorageDownloadTokens: token },
        });

        const downloadUrl =
          `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}` +
          `/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

        logger.info({ uid: req.uid, folder, size: file.size }, "[Upload] File saved via Admin SDK");

        // Kick off a background sitemap rebuild whenever content folders are updated
        if (folder === "notes" || folder === "pyqs") {
          triggerSitemapRefresh();
        }

        return res.json({ url: downloadUrl });
      }

      // ── Admin SDK unavailable — reject (no anonymous fallback) ──────────────
      logger.error("[Upload] Admin SDK not available — FIREBASE_SERVICE_ACCOUNT_JSON required.");
      return res.status(503).json({
        error:
          "File upload requires FIREBASE_SERVICE_ACCOUNT_JSON to be configured on the server. " +
          "Go to Firebase Console → Project Settings → Service Accounts → Generate new private key.",
      });
    } catch (err) {
      logger.error(err, "[Upload] Error");
      return res.status(500).json({ error: "Server error during upload." });
    }
  },
);

// ── Profile avatar upload ─────────────────────────────────────────────────────
// Routes through the backend (Admin SDK) to avoid browser CORS restrictions
// on Firebase Storage when hosted on Replit or custom domains.
// The avatar is always stored at avatars/{uid}.jpg and the Firestore
// users/{uid}.photoURL is updated atomically after upload.
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB max (already compressed by client)
});

router.post(
  "/upload/avatar",
  requireAuth,
  avatarUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided." });

      // Only allow safe, non-executable image types for avatars.
      // Rejects SVG (XSS), GIF, HEIC, executables, PDFs, video, audio.
      const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
      if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
        return res.status(400).json({ error: "Only JPEG, PNG, and WebP images are allowed for avatars." });
      }

      const storage = getAdminStorage();
      const db      = getAdminDb();
      if (!storage || !STORAGE_BUCKET || !db) {
        // Return 503 so the client falls through to the Firestore data-URL fallback.
        return res.status(503).json({
          error: "Storage not available — FIREBASE_SERVICE_ACCOUNT_JSON required.",
        });
      }

      const uid  = req.uid!;
      const path = `avatars/${uid}.jpg`;
      const token = crypto.randomUUID();

      const bucket  = storage.bucket(STORAGE_BUCKET);
      const fileRef = bucket.file(path);
      await fileRef.save(file.buffer, {
        contentType: "image/jpeg",
        metadata:    { firebaseStorageDownloadTokens: token },
      });

      const downloadUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}` +
        `/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

      // Update Firestore users/{uid}.photoURL — must succeed before reporting success
      if (db) {
        try {
          await db.collection("users").doc(uid).update({ photoURL: downloadUrl });
        } catch (fsErr) {
          logger.error({ err: fsErr, uid }, "[Upload] Firestore photoURL update failed");
          return res.status(500).json({ error: "Photo saved but profile update failed — please try again." });
        }
      }

      logger.info({ uid, size: file.size }, "[Upload] Avatar saved");
      return res.json({ url: downloadUrl });
    } catch (err) {
      logger.error(err, "[Upload] Avatar error");
      return res.status(500).json({ error: "Avatar upload failed." });
    }
  },
);

export default router;
