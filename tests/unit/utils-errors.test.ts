import { describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError, isUniqueConstraintError, toActionError } from "@/lib/errors";
import { formatPrice, toEnglishDigits, toPersianDigits } from "@/lib/utils";

describe("digit helpers", () => {
  it("converts between Persian/Arabic and ASCII digits", () => {
    expect(toEnglishDigits("۱۲۳٤٥٦")).toBe("123456");
    expect(toPersianDigits(2026)).toBe("۲۰۲۶");
  });

  it("formats prices in Toman with Persian digits", () => {
    expect(formatPrice(250000)).toContain("تومان");
    expect(formatPrice(250000)).toContain("۲۵۰");
  });
});

describe("error helpers", () => {
  it("exposes AppError messages to the client", () => {
    expect(toActionError(new ForbiddenError())).toEqual({
      ok: false,
      error: "شما مجوز انجام این عملیات را ندارید.",
      fieldErrors: undefined,
    });
    expect(toActionError(new AppError("x", "X", { a: ["b"] }))).toEqual({ ok: false, error: "x", fieldErrors: { a: ["b"] } });
  });

  it("hides unexpected errors behind a generic message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toActionError(new Error("connection string with password=secret"));
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain("secret");
    spy.mockRestore();
  });

  it("detects Prisma unique constraint errors", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError({ code: "P2025" })).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
