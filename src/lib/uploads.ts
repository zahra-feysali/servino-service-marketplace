import { AppError } from "@/lib/errors";
import { detectMimeType, sanitizeFileName } from "@/lib/files";
import { MAX_UPLOAD_MB, type UploadableMime } from "@/features/forms/definitions";

export const IMAGE_MIME_TYPES: UploadableMime[] = ["image/jpeg", "image/png", "image/webp"];
export const DOCUMENT_MIME_TYPES: UploadableMime[] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Server-side validation of one uploaded file: non-empty, size limit, and the REAL content type
 * detected from the bytes (the browser-declared type is ignored). Returns bytes + detected MIME.
 */
export async function readValidatedFile(file: File, allowed: UploadableMime[], maxBytes = MAX_UPLOAD_MB * 1024 * 1024) {
  const name = sanitizeFileName(file.name);
  if (file.size <= 0) throw new AppError(`فایل «${name}» خالی است.`, "INVALID_FILE");
  if (file.size > maxBytes) throw new AppError(`حجم فایل «${name}» بیش از ${Math.round(maxBytes / 1024 / 1024)} مگابایت است.`, "INVALID_FILE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectMimeType(bytes);
  if (!mime || !allowed.includes(mime)) throw new AppError(`نوع فایل «${name}» مجاز نیست.`, "INVALID_FILE");
  return { bytes, mime, fileName: name, size: bytes.byteLength };
}
