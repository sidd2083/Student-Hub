import {
  ref, uploadBytesResumable, getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";

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

/** Human-readable message from a Firebase Storage error. */
function storageErrorMsg(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  if (code === "storage/unauthorized")      return "Permission denied — make sure you are signed in.";
  if (code === "storage/bucket-not-found")  return "Storage not configured — add VITE_FIREBASE_STORAGE_BUCKET to your environment variables.";
  if (code === "storage/object-not-found")  return "Photo not found — it may have already been deleted.";
  if (code === "storage/quota-exceeded")    return "Storage quota exceeded — contact support.";
  if (code === "storage/unauthenticated")   return "Sign in first, then try again.";
  if (code === "storage/invalid-argument")  return "Invalid file — please pick a regular image (JPG, PNG, WEBP).";
  if (code === "storage/canceled")          return "Upload cancelled.";
  if (code.startsWith("storage/"))         return `Upload failed (${code}) — please try again.`;
  const msg = (err as { message?: string }).message ?? "";
  if (msg.toLowerCase().includes("cors"))  return "CORS error — Firebase Storage CORS is not configured for this origin.";
  return "Upload failed — please try again.";
}

/**
 * Upload a profile photo, report real byte-level progress (0→100 %),
 * and save the download URL to Firestore users/{uid}.photoURL.
 */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
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

  // ── 2. Upload with real byte-level progress ────────────────────────────────
  const storageRef = ref(storage, `avatars/${uid}.jpg`);
  const task       = uploadBytesResumable(storageRef, blob, { contentType: "image/jpeg" });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const pct = snap.bytesTransferred / snap.totalBytes;
        onProgress?.(Math.round(15 + pct * 80));   // 15 → 95
      },
      (err) => reject(new Error(storageErrorMsg(err))),
      () => resolve(),
    );
  });

  onProgress?.(96);

  // ── 3. Get download URL ────────────────────────────────────────────────────
  let url: string;
  try {
    url = await getDownloadURL(task.snapshot.ref);
  } catch (err) {
    throw new Error(storageErrorMsg(err));
  }
  onProgress?.(98);

  // ── 4. Persist to Firestore ────────────────────────────────────────────────
  try {
    await updateDoc(doc(db, "users", uid), { photoURL: url });
  } catch (err) {
    console.warn("[Photo] Firestore update failed:", err);
    // Return the URL anyway — user can still use the photo
  }
  onProgress?.(100);

  return url;
}

/** Delete photo from Storage + clear Firestore field. */
export async function removeProfilePhoto(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `avatars/${uid}.jpg`)).catch(() => {});
    await updateDoc(doc(db, "users", uid), { photoURL: null });
  } catch (err) {
    console.warn("[Photo] removeProfilePhoto:", err);
  }
}
