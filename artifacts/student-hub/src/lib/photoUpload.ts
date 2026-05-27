import {
  ref, uploadBytesResumable, getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db, isConfigured } from "@/lib/firebase";

const MAX_PX      = 512;   // max width or height
const JPEG_Q      = 0.82;  // single-pass quality — good balance of size vs clarity

/** Resize + JPEG-compress an image File using an off-screen Canvas. */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Scale down to fit MAX_PX × MAX_PX while keeping aspect ratio
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

      // White background so transparent PNGs get a clean JPEG background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/jpeg",
        JPEG_Q,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image failed to load — file may be corrupt"));
    };

    img.src = objectUrl;
  });
}

/**
 * Upload a profile photo to Firebase Storage, report real byte-level progress,
 * and save the public download URL to Firestore `users/{uid}.photoURL`.
 *
 * Progress values: 0 → 15 (compress) → 15–95 (upload) → 100 (Firestore saved)
 */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (!isConfigured) throw new Error("Firebase not configured");
  if (!file.type.startsWith("image/")) throw new Error("Please pick an image file");

  onProgress?.(5);

  // ── 1. Compress ────────────────────────────────────────────────────────────
  const blob = await compressImage(file);
  onProgress?.(15);

  // ── 2. Upload with real progress ───────────────────────────────────────────
  const storageRef  = ref(storage, `avatars/${uid}.jpg`);
  const uploadTask  = uploadBytesResumable(blob, { contentType: "image/jpeg" });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // Map upload bytes → 15 … 95 % range
        const uploadPct = snapshot.bytesTransferred / snapshot.totalBytes;
        onProgress?.(Math.round(15 + uploadPct * 80));
      },
      (err) => reject(err),
      () => resolve(),
    );
  });

  onProgress?.(96);

  // ── 3. Get public URL ──────────────────────────────────────────────────────
  const url = await getDownloadURL(uploadTask.snapshot.ref);
  onProgress?.(98);

  // ── 4. Save to Firestore ───────────────────────────────────────────────────
  await updateDoc(doc(db, "users", uid), { photoURL: url });
  onProgress?.(100);

  return url;
}

/**
 * Delete the profile photo from Storage and clear the Firestore field.
 */
export async function removeProfilePhoto(uid: string): Promise<void> {
  if (!isConfigured) return;
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`)).catch(() => {});
    await updateDoc(doc(db, "users", uid), { photoURL: null });
  } catch (err) {
    console.warn("[Photo] removeProfilePhoto error:", err);
  }
}
