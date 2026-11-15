import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  loginSchema,
  normalizePhone,
  parseIdentifier,
  registerSchema,
} from "@/features/auth/schemas";

const validRegistration = {
  role: "CUSTOMER" as const,
  fullName: "سارا محمدی",
  phone: "09121234567",
  email: "",
  password: "Secret123",
  confirmPassword: "Secret123",
  acceptTerms: true as const,
};

describe("normalizePhone", () => {
  it.each([
    ["09121234567", "09121234567"],
    ["+989121234567", "09121234567"],
    ["00989121234567", "09121234567"],
    ["989121234567", "09121234567"],
    ["9121234567", "09121234567"],
    ["۰۹۱۲۱۲۳۴۵۶۷", "09121234567"],
    ["0912 123 4567", "09121234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("parseIdentifier", () => {
  it("detects emails (lower-cased)", () => {
    expect(parseIdentifier("User@Example.com")).toEqual({ kind: "email", value: "user@example.com" });
  });
  it("detects phones in Persian digits", () => {
    expect(parseIdentifier("۰۹۱۲۱۲۳۴۵۶۷")).toEqual({ kind: "phone", value: "09121234567" });
  });
  it("rejects garbage", () => {
    expect(parseIdentifier("hello")).toBeNull();
    expect(parseIdentifier("bad@")).toBeNull();
  });
});

describe("loginSchema", () => {
  it("requires identifier and password", () => {
    expect(loginSchema.safeParse({ identifier: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: "09121234567", password: "x" }).success).toBe(true);
  });
});

describe("registerSchema", () => {
  it("accepts a valid customer registration and normalizes fields", () => {
    const result = registerSchema.safeParse({ ...validRegistration, phone: "+989121234567", email: "  A@B.COM " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("09121234567");
      expect(result.data.email).toBe("a@b.com");
    }
  });

  it("treats empty email as undefined", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success && result.data.email).toBe(undefined);
  });

  it("never allows self-registration as ADMIN", () => {
    expect(registerSchema.safeParse({ ...validRegistration, role: "ADMIN" }).success).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: "short1", confirmPassword: "short1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, password: "onlyletters", confirmPassword: "onlyletters" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, password: "12345678", confirmPassword: "12345678" }).success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: "Other1234" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rejects invalid phone numbers and emails", () => {
    expect(registerSchema.safeParse({ ...validRegistration, phone: "0212345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...validRegistration, email: "not-an-email" }).success).toBe(false);
  });

  it("requires accepting the terms", () => {
    expect(registerSchema.safeParse({ ...validRegistration, acceptTerms: false }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("requires the new password to differ and match confirmation", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "Secret123", newPassword: "Secret123", confirmPassword: "Secret123" }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "Secret123", newPassword: "NewPass123", confirmPassword: "NewPass124" }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "Secret123", newPassword: "NewPass123", confirmPassword: "NewPass123" }).success,
    ).toBe(true);
  });
});
