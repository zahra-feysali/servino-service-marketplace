import { describe, expect, it } from "vitest";
import { mergeFiles, formatFileSize } from "@/components/shared/multi-file-input";
import { avatarSrc, canViewAvatar, initialsOf } from "@/features/avatars/rules";

const png = (name: string, size = 1000, lastModified = 1) =>
  new File([new Uint8Array(size)], name, { type: "image/png", lastModified });
const pdf = (name: string, size = 1000) => new File([new Uint8Array(size)], name, { type: "application/pdf", lastModified: 2 });
const rules = { accept: ["image/png", "application/pdf"], maxBytes: 5_000, maxFiles: 3 };

describe("multi-file selection (mergeFiles)", () => {
  it("adds several files at once and more later", () => {
    const first = mergeFiles([], [png("a.png"), pdf("b.pdf")], rules);
    expect(first.files.map((f) => f.name)).toEqual(["a.png", "b.pdf"]);
    expect(first.errors).toEqual([]);
    const second = mergeFiles(first.files, [png("c.png", 2000, 9)], rules);
    expect(second.files.map((f) => f.name)).toEqual(["a.png", "b.pdf", "c.png"]);
  });

  it("skips duplicates silently", () => {
    const a = png("a.png");
    const r = mergeFiles([a], [png("a.png")], rules);
    expect(r.files).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it("rejects wrong types, oversize, empty files and anything over the limit", () => {
    const exe = new File([new Uint8Array(10)], "x.exe", { type: "application/x-msdownload" });
    const r = mergeFiles(
      [png("1.png", 10, 11)],
      [exe, png("big.png", 9_000, 12), png("empty.png", 0, 13), png("2.png", 10, 14), png("3.png", 10, 15), png("4.png", 10, 16)],
      rules,
    );
    expect(r.files.map((f) => f.name)).toEqual(["1.png", "2.png", "3.png"]);
    expect(r.errors).toHaveLength(4);
    expect(r.errors.join(" ")).toContain("x.exe");
    expect(r.errors.join(" ")).toContain("big.png");
    expect(r.errors.join(" ")).toContain("empty.png");
    expect(r.errors.join(" ")).toContain("4.png");
  });

  it("formats sizes in Persian", () => {
    expect(formatFileSize(512)).toBe("۵۱۲ بایت");
    expect(formatFileSize(2048)).toBe("۲ کیلوبایت");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("۵ مگابایت");
  });
});

describe("avatar rules", () => {
  const customer = { id: "c", role: "CUSTOMER" as const, isPublicProvider: false };
  const approvedProvider = { id: "p", role: "PROVIDER" as const, isPublicProvider: true };
  const pendingProvider = { id: "q", role: "PROVIDER" as const, isPublicProvider: false };

  it("makes approved provider pictures public and keeps customer pictures private", () => {
    expect(canViewAvatar(null, approvedProvider, false)).toBe(true);
    expect(canViewAvatar(null, customer, false)).toBe(false);
    expect(canViewAvatar({ id: "x", role: "PROVIDER" }, customer, false)).toBe(false);
    expect(canViewAvatar({ id: "x", role: "PROVIDER" }, customer, true)).toBe(true);
    expect(canViewAvatar({ id: "c", role: "CUSTOMER" }, customer, false)).toBe(true);
    expect(canViewAvatar({ id: "a", role: "ADMIN" }, customer, false)).toBe(true);
    expect(canViewAvatar({ id: "y", role: "CUSTOMER" }, pendingProvider, false)).toBe(false);
  });

  it("builds versioned URLs and initials", () => {
    expect(avatarSrc("u1", null)).toBeNull();
    expect(avatarSrc("u1", new Date(1_700_000_000_000))).toBe("/api/avatars/u1?v=1700000000000");
    expect(initialsOf("زهرا فیصلی")).toBe("ز‌ف");
    expect(initialsOf("علی")).toBe("ع");
    expect(initialsOf("  ")).toBe("؟");
  });
});
