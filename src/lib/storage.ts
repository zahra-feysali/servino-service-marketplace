import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EXTENSION_BY_MIME, STORAGE_KEY_REGEX } from "@/lib/files";
import type { UploadableMime } from "@/features/forms/definitions";

/**
 * Private local file storage (outside `public/`). Files are only ever served through
 * auth-checked route handlers. Keys are generated here and validated on read, so a
 * client-supplied value can never escape the storage root (path traversal).
 */

function storageRoot(): string {
  const dir = process.env.UPLOAD_DIR || "storage/uploads";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), dir);
}

function resolveKey(key: string): string {
  if (!STORAGE_KEY_REGEX.test(key)) throw new Error("Invalid storage key");
  const root = storageRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function saveFile(bytes: Uint8Array, mime: UploadableMime): Promise<string> {
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXTENSION_BY_MIME[mime]}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });
  return key;
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteStoredFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => rm(resolveKey(k), { force: true }).catch(() => undefined)));
}
