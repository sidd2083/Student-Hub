import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db, isConfigured } from "@/lib/firebase";

const MAX_SIZE_PX  = 512;
const TARGET_BYTES = 300_000; // 300 KB target

/** Resize + compress an image File using Canvas. Returns a Blob. */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img  = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth: w, naturalHeight: h } = img;
      let dw = w, dh = h;
      if (w > MAX_SIZE_PX || h > MAX_SIZE_PX) {
        if (w > h) { dw = MAX_SIZE_PX; dh = Math.round(h * MAX_SIZE_PX / w); }
        else        { dh = MAX_SIZE_PX; dw = Math.round(w * MAX_SIZE_PX / h); }
      }

      const canvas = document.createElement("canvas");
      canvas.width  = dw;
      canvas.height = dh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, dw, dh);

      // Binary-search quality to stay ≤ TARGET_BYTES
      let lo = 0.4, hi = 0.95, best: Blob | null = null;

      function tryQuality(q: number): Promise<Blob | null> {
        return new Promise(res =>
          canvas.toBlob(b => res(b), "image/jpeg", q)
        );
      }

      (async () => {
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          const b   = await tryQuality(mid);
          if (!b) break;
          if (b.size <= TARGET_BYTES) { best = b; lo = mid; }
          else                        { hi  = mid; }
        }
        if (!best) best = await tryQuality(lo);
        if (best)  resolve(best);
        else       reject(new Error("Canvas toBlob returned null"));
      })();
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

/**
 * Upload a profile photo to Firebase Storage and save the URL to Firestore.
 * Returns the public download URL.
 */
export async function uploadProfilePhoto(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (!isConfigured) throw new Error("Firebase not configured");
  if (!file.type.startsWith("image/")) throw new Error("File must be an image");

  onProgress?.(5);

  // Compress first
  const blob = await compressImage(file);
  onProgress?.(40);

  // Upload to Storage: avatars/{uid}.jpg
  const storageRef = ref(storage, `avatars/${uid}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  onProgress?.(80);

  // Get the public URL
  const url = await getDownloadURL(storageRef);
  onProgress?.(90);

  // Save URL to Firestore user doc
  await updateDoc(doc(db, "users", uid), { photoURL: url });
  onProgress?.(100);

  return url;
}

/**
 * Delete profile photo from Storage + clear Firestore field.
 */
export async function removeProfilePhoto(uid: string): Promise<void> {
  if (!isConfigured) return;
  try {
    const storageRef = ref(storage, `avatars/${uid}.jpg`);
    await deleteObject(storageRef).catch(() => {});
    await updateDoc(doc(db, "users", uid), { photoURL: null });
  } catch (err) {
    console.warn("[Photo] removeProfilePhoto error:", err);
  }
}
