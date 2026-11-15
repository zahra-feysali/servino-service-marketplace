import type { UploadableMime } from "@/features/forms/definitions";

/**
 * Detects the real file type from its first bytes (magic numbers).
 * The browser-declared MIME type is never trusted on its own.
 */
export function detectMimeType(bytes: Uint8Array): UploadableMime | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return "application/pdf"; // %PDF-
  }
  return null;
}

export const EXTENSION_BY_MIME: Record<UploadableMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Strips path components and control characters from a user-supplied file name (for display only). */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim();
  return (cleaned || "file").slice(0, 150);
}

/** Storage keys are generated server-side only: `<yyyy>/<mm>/<uuid>.<ext>`. */
export const STORAGE_KEY_REGEX = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
