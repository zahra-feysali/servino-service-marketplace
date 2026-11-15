import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STORAGE_KEY_REGEX, detectMimeType, sanitizeFileName } from "@/lib/files";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
const PDF = new TextEncoder().encode("%PDF-1.7\n");
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script>");

describe("detectMimeType (magic bytes)", () => {
  it("recognizes allowed formats", () => {
    expect(detectMimeType(PNG)).toBe("image/png");
    expect(detectMimeType(JPG)).toBe("image/jpeg");
    expect(detectMimeType(PDF)).toBe("application/pdf");
    expect(detectMimeType(WEBP)).toBe("image/webp");
  });
  it("rejects anything else regardless of declared type/extension", () => {
    expect(detectMimeType(HTML)).toBeNull();
    expect(detectMimeType(new Uint8Array())).toBeNull();
  });
});

describe("file names and storage keys", () => {
  it("sanitizes user-provided names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\x\\evil<>.png")).toBe("evil.png");
    expect(sanitizeFileName("")).toBe("file");
  });
  it("only accepts server-generated keys", () => {
    expect(STORAGE_KEY_REGEX.test("2026/11/0b1c2d3e-0000-4000-8000-123456789abc.png")).toBe(true);
    expect(STORAGE_KEY_REGEX.test("../secret.png")).toBe(false);
    expect(STORAGE_KEY_REGEX.test("2026/11/../../x.png")).toBe(false);
    expect(STORAGE_KEY_REGEX.test("2026/11/0b1c2d3e-0000-4000-8000-123456789abc.html")).toBe(false);
  });
});

describe("private storage", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "servino-upload-test-"));
    process.env.UPLOAD_DIR = dir;
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("saves, reads and deletes files by generated key", async () => {
    const { saveFile, readStoredFile, deleteStoredFiles } = await import("@/lib/storage");
    const key = await saveFile(PNG, "image/png");
    expect(STORAGE_KEY_REGEX.test(key)).toBe(true);
    expect(new Uint8Array(await readStoredFile(key))).toEqual(PNG);
    await deleteStoredFiles([key]);
    await expect(readStoredFile(key)).rejects.toThrow();
  });

  it("refuses path traversal keys", async () => {
    const { readStoredFile } = await import("@/lib/storage");
    await expect(readStoredFile("../../package.json")).rejects.toThrow("Invalid storage key");
  });
});
