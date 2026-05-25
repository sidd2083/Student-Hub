/**
 * Slug utilities — shared across Notes, PYQs, Admin and all link generators.
 *
 * URL format:
 *   /notes/{firestoreId}-grade-{grade}-{subject-slug}-{title-slug}
 *   /pyq/{firestoreId}-grade-{grade}-{subject-slug}-{year}-{title-slug}
 *
 * Firestore auto-generated IDs are 20 chars of base62 (A–Za–z0–9), never
 * containing hyphens. That means splitting on the first '-' always yields
 * the real document ID — making both old bare-ID URLs and new slug URLs work
 * without any migration or redirect logic.
 */

export function toSlug(str: string): string {
  return (str ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function noteUrl(note: {
  id: string;
  grade: number;
  subject: string;
  title: string;
}): string {
  return `/notes/${note.id}-grade-${note.grade}-${toSlug(note.subject)}-${toSlug(note.title)}`;
}

export function pyqUrl(pyq: {
  id: string;
  grade: number;
  subject: string;
  title: string;
  year: number;
}): string {
  return `/pyq/${pyq.id}-grade-${pyq.grade}-${toSlug(pyq.subject)}-${pyq.year}-${toSlug(pyq.title)}`;
}

/**
 * Extract the Firestore document ID from a URL parameter.
 * Works for both old bare-ID params ("/notes/abc123") and new slug params
 * ("/notes/abc123-grade-10-mathematics-quadratic-equations").
 */
export function extractFirestoreId(param: string): string {
  const idx = param.indexOf("-");
  if (idx === -1) return param;
  return param.slice(0, idx);
}

export const SITE_URL = "https://www.studenthubnp.com";

export function noteCanonical(note: {
  id: string;
  grade: number;
  subject: string;
  title: string;
}): string {
  return `${SITE_URL}${noteUrl(note)}`;
}

export function pyqCanonical(pyq: {
  id: string;
  grade: number;
  subject: string;
  title: string;
  year: number;
}): string {
  return `${SITE_URL}${pyqUrl(pyq)}`;
}
