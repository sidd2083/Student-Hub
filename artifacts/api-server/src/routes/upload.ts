import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger";
import { getAdminStorage } from "../lib/firebase-admin";
import crypto from "crypto";

const router = Router();

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
});

const STORAGE_BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET;

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif",
  "application/pdf",
];

router.post(
  "/upload",
  multerUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided." });

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: "Only PDF and image files are allowed." });
    }

    const folder = typeof req.body?.folder === "string"
      ? req.body.folder.replace(/[^a-z0-9_\-]/gi, "").slice(0, 50) || "uploads"
      : "uploads";

    const ext  = (file.originalname.split(".").pop() ?? "bin").toLowerCase();
    const path = `${folder}/${Date.now()}.${ext}`;

    // ── Attempt 1: Firebase Admin SDK (bypasses Storage rules entirely) ──────
    const storage = getAdminStorage();
    if (storage && STORAGE_BUCKET) {
      try {
        const bucket    = storage.bucket(STORAGE_BUCKET);
        const fileRef   = bucket.file(path);
        const token     = crypto.randomUUID();

        await fileRef.save(file.buffer, {
          contentType: file.mimetype,
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        });

        const downloadUrl =
          `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}` +
          `/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

        return res.json({ url: downloadUrl });
      } catch (adminErr) {
        logger.warn({ adminErr }, "Admin SDK upload failed, trying REST fallback");
      }
    }

    // ── Attempt 2: Firebase REST API (no-auth path for open rules) ──────────
    if (!STORAGE_BUCKET) {
      return res.status(503).json({ error: "Storage not configured on server." });
    }

    try {
      const uploadUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}` +
        `/o?uploadType=media&name=${encodeURIComponent(path)}`;

      const uploadRes = await fetch(uploadUrl, {
        method:  "POST",
        headers: { "Content-Type": file.mimetype },
        body:    file.buffer,
      });

      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => ({})) as { error?: { message?: string } };
        const msg = errBody?.error?.message ?? `HTTP ${uploadRes.status}`;
        logger.warn({ status: uploadRes.status, msg }, "REST upload failed");

        if (uploadRes.status === 403 || uploadRes.status === 401) {
          return res.status(403).json({
            error:
              "Firebase Storage is blocking uploads. " +
              "Go to Firebase Console → Storage → Rules and publish the storage.rules file, " +
              "or set FIREBASE_SERVICE_ACCOUNT_JSON on Vercel for Admin SDK uploads.",
          });
        }
        return res.status(502).json({ error: "Storage upload failed: " + msg });
      }

      const data = await uploadRes.json() as { name?: string; downloadTokens?: string };
      const downloadUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}` +
        `/o/${encodeURIComponent(data.name ?? path)}?alt=media&token=${data.downloadTokens ?? ""}`;

      return res.json({ url: downloadUrl });
    } catch (err) {
      logger.error(err, "Upload route error");
      return res.status(500).json({ error: "Server error during upload." });
    }
  }
);

export default router;
