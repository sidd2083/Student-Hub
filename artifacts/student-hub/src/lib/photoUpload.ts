import { doc, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

const MAX_PX   = 512;
const JPEG_Q   = 0.82;
const MINI_PX  = 220;   // for Firestore data-URL fallback
const MINI_Q   = 0.65;

/** Resize + JPEG-compress an image File using an off-screen Canvas. */
async function compressImage(file: File, maxPx = MAX_PX, quality = JPEG_Q): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else        { w = Math.round(w * maxPx / h); h = maxPx; }
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
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image — file may be corrupt"));
    };

    img.src = objectUrl;
  });
}

/** Compress to a tiny JPEG and return a base64 data URL suitable for Firestore. */
async function compressToDataURL(file: File): Promise<string> {
  const blob = await compressImage(file, MINI_PX, MINI_Q);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read compressed image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a profile photo.
 *
 * Strategy (in order):
 *   1. POST /api/upload/avatar  — Express + Firebase Admin SDK (best: works on any domain)
 *   2. Firebase Storage client SDK  — if backend returns 503 (no service account)
 *   3. Firestore data-URL  — if Storage is also unavailable/blocked
 *      (220 px JPEG ~8-20 KB, well within Firestore's 1 MB document limit)
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

  // ── 1. Compress for backend / Storage upload ────────────────────────────────
  let blob: Blob;
  try {
    blob = await compressImage(file);
  } catch (err) {
    throw new Error((err as Error).message || "Compression failed");
  }
  onProgress?.(15);

  // ── 2. Try backend (Admin SDK path) ────────────────────────────────────────
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let fakeProgress = 15;

  try {
    progressTimer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 5, 85);
      onProgress?.(fakeProgress);
    }, 300);

    const formData = new FormData();
    formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

    let headers: Record<string, string> = {};
    if (getIdToken) {
      try { headers = { Authorization: `Bearer ${await getIdToken()}` }; }
      catch { /* proceed without auth header */ }
    }

    const res = await fetch("/api/upload/avatar", {
      method: "POST",
      headers,
      body:   formData,
    });

    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }

    if (res.ok) {
      const data = await res.json();
      if (!data.url) throw new Error("Server did not return a download URL.");
      onProgress?.(100);
      return data.url as string;
    }

    // Backend not configured — fall through to client-side paths
    if (res.status !== 503 && res.status !== 401 && res.status !== 403) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Upload failed (HTTP ${res.status})`);
    }

  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }

  // ── 3. Try Firebase Storage client SDK ─────────────────────────────────────
  onProgress?.(50);
  try {
    const sRef = storageRef(storage, `avatars/${uid}.jpg`);
    const snap = await uploadBytes(sRef, blob, { contentType: "image/jpeg" });
    onProgress?.(80);
    const url = await getDownloadURL(snap.ref);
    onProgress?.(92);
    await updateDoc(doc(db, "users", uid), { photoURL: url });
    onProgress?.(100);
    return url;
  } catch (storageErr) {
    console.warn("[PhotoUpload] Firebase Storage unavailable, falling back to Firestore data-URL:", storageErr);
  }

  // ── 4. Firestore data-URL fallback (always works if user is authenticated) ──
  onProgress?.(60);
  let dataURL: string;
  try {
    dataURL = await compressToDataURL(file);
  } catch (err) {
    throw new Error("Could not compress image for upload. Try a different photo.");
  }

  onProgress?.(80);
  try {
    await updateDoc(doc(db, "users", uid), { photoURL: dataURL });
  } catch (err) {
    throw new Error("Profile update failed — make sure you are signed in and try again.");
  }

  onProgress?.(100);
  return dataURL;
}

/** Delete photo from Storage + clear Firestore field. */
export async function removeProfilePhoto(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "users", uid), { photoURL: null });
  } catch (err) {
    console.warn("[Photo] removeProfilePhoto:", err);
  }
}
