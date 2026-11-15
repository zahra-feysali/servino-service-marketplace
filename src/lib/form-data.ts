import { toEnglishDigits } from "@/lib/utils";

/**
 * Helpers for reading Server Action FormData. Values are only *collected* here;
 * every action still validates the result with a Zod schema.
 */

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

/** Like `str`, with Persian/Arabic digits converted (for numeric inputs). */
export function num(fd: FormData, key: string): string {
  return toEnglishDigits(str(fd, key)).trim();
}

/** Checkbox / switch: present with "on" (or "true") means checked. */
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true";
}

export function strs(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v !== "");
}

export function file(fd: FormData, key: string): File | null {
  const v = fd.get(key);
  return v instanceof File && v.size > 0 ? v : null;
}
