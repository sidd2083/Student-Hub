import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger";

const router = Router();

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const STORAGE_BUCKET = process.env.VITE_FIREBASE_STORAGE_BUCKET;
const API_KEY        = process.env.VITE_FIREBASE_API_KEY;

async function getAnonIdToken(): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as { idToken?: string };
    return data.idToken ?? null;
  } catch {
    return null;
  }
}

router.post(
  "/upload",
  multerUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided." });

    if (!STORAGE_BUCKET || !API_KEY) {
      return res.status(503).json({ error: "Storage not configured on server." });
    }

    const allowed = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf",
    ];
    if (!allowed.includes(file.mimetype)) {
      return res.status(400).json({ error: "File type not allowed." });
    }

    const folder = typeof req.body?.folder === "string" ? req.body.folder.replace(/[^a-z0-9_-]/gi, "") || "uploads" : "uploads";
    const ext    = (file.originalname.split(".").pop() ?? "bin").toLowerCase();
    const path   = `${folder}/${Date.now()}.${ext}`;

    try {
      const idToken = await getAnonIdToken();

      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}/o?uploadType=media&name=${encodeURIComponent(path)}`;
      const headers: Record<string, string> = { "Content-Type": file.mimetype };
      if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: file.buffer,
      });

      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => ({})) as { error?: { message?: string } };
        const msg = errBody?.error?.message ?? `HTTP ${uploadRes.status}`;
        logger.warn({ status: uploadRes.status, msg }, "Storage upload failed");

        if (uploadRes.status === 403 || uploadRes.status === 401) {
          return res.status(403).json({
            error: "Firebase Storage is blocking uploads. Go to Firebase Console → Storage → Rules and set: allow write: if request.auth != null;  then deploy with: firebase deploy --only storage",
          });
        }
        return res.status(502).json({ error: "Storage upload failed: " + msg });
      }

      const data = await uploadRes.json() as { name?: string; downloadTokens?: string };
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(STORAGE_BUCKET)}/o/${encodeURIComponent(data.name ?? path)}?alt=media&token=${data.downloadTokens ?? ""}`;

      return res.json({ url: downloadUrl });
    } catch (err) {
      logger.error(err, "Upload route error");
      return res.status(500).json({ error: "Server error during upload." });
    }
  }
);

export default router;
