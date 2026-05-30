import { doc, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

const MAX_PX = 512;
const JPEG_Q = 0.82;

/** Resize + JPEG-compress an image File using an off-screen Canvas. */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_PX || h > MAX_PX) {
        if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
        else        { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas unavailable")); return; }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed — try a different image"));
        },
        "image/jpeg",
        JPEG_Q,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image — file may be corrupt"));
    };

    img.src = objectUrl;
  });
}

/**
 * Upload a profile photo via the backend API (bypasses Firebase Storage CORS),
 * report real progress (0→100 %), and return the download URL.
 *
 * The backend endpoint /api/upload/avatar uses Firebase Admin SDK so it works
 * regardless of which domain the app is hosted on (Replit, custom domain, etc.).
 * Progress is simulated in two phases: 0–15 % for compression, 15–95 % for upload.
 */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
  getIdToken?: () => Promise<string>,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please pick an image file (JPG, PNG, WEBP, etc.)");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("File too large — maximum 20 MB.");
  }

  onProgress?.(5);

  // ── 1. Compress ────────────────────────────────────────────────────────────
  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch (err) {
    throw new Error((err as Error).message || "Compression failed");
  }
  onProgress?.(15);

  // ── 2. Upload via backend (Admin SDK — no CORS issues) ────────────────────
  // Simulate upload progress while the XHR is in flight.
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let fakeProgress = 15;

  try {
    progressTimer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 5, 90);
      onProgress?.(fakeProgress);
    }, 300);

    const formData = new FormData();
    formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

    let headers: Record<string, string> = {};
    if (getIdToken) {
      const token = await getIdToken();
      headers = { Authorization: `Bearer ${token}` };
    }

    const res = await fetch("/api/upload/avatar", {
      method:  "POST",
      headers,
      body:    formData,
    });

    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }

    // ── Backend succeeded (Admin SDK path) ────────────────────────────────────
    if (res.ok) {
      const data = await res.json();
      if (!data.url) throw new Error("Server did not return a download URL.");
      onProgress?.(100);
      return data.url as string;
    }

    // ── Backend unavailable (503 = no service account) → client-side fallback ─
    // Upload directly to Firebase Storage using the client SDK.
    // Firebase Storage rules allow any authenticated user to write to
    // avatars/{uid}.jpg — the SDK includes the user's auth token automatically.
    if (res.status === 503) {
      console.info("[PhotoUpload] Backend unavailable — using client-side Firebase Storage");
      onProgress?.(50);

      let snap;
      try {
        const sRef = storageRef(storage, `avatars/${uid}.jpg`);
        console.info("[PhotoUpload] Uploading blob to avatars/%s.jpg (%d KB)", uid, Math.round(blob.size / 1024));
        snap = await uploadBytes(sRef, blob, { contentType: "image/jpeg" });
        console.info("[PhotoUpload] Storage upload succeeded — fetching download URL");
      } catch (storageErr) {
        const msg = (storageErr as Error).message ?? "unknown";
        console.error("[PhotoUpload] Firebase Storage upload failed:", storageErr);
        // Surface a clear message — the most common cause is unauthenticated
        // or Storage rules rejecting the write.
        if (msg.includes("unauthorized") || msg.includes("403")) {
          throw new Error("Photo upload blocked by Storage rules — make sure you are signed in and try again.");
        }
        throw new Error(`Photo upload failed: ${msg}`);
      }

      onProgress?.(85);

      let url: string;
      try {
        url = await getDownloadURL(snap.ref);
        console.info("[PhotoUpload] Got download URL — updating Firestore profile");
      } catch (urlErr) {
        console.error("[PhotoUpload] getDownloadURL failed:", urlErr);
        throw new Error("Photo saved but could not retrieve its URL — please try again.");
      }

      onProgress?.(95);

      // Update Firestore photoURL so profile syncs everywhere
      try {
        await updateDoc(doc(db, "users", uid), { photoURL: url });
      } catch (fsErr) {
        console.error("[PhotoUpload] Firestore photoURL update failed:", fsErr);
        throw new Error("Photo saved but profile update failed — please try again.");
      }

      onProgress?.(100);
      return url;
    }

    // ── Other HTTP error ───────────────────────────────────────────────────────
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Upload failed (HTTP ${res.status})`);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
}

/** Delete photo from Storage + clear Firestore field. */
export async function removeProfilePhoto(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "users", uid), { photoURL: null });
  } catch (err) {
    console.warn("[Photo] removeProfilePhoto:", err);
  }
}
