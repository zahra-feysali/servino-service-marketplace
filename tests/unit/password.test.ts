import { describe, expect, it } from "vitest";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/features/auth/password";

describe("password hashing", () => {
  it("hashes with bcrypt and verifies correctly", async () => {
    const hash = await hashPassword("Secret123");
    expect(hash).not.toBe("Secret123");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("Secret123", hash)).toBe(true);
    expect(await verifyPassword("Wrong123", hash)).toBe(false);
  });

  it("burnPasswordCheck always fails", async () => {
    expect(await burnPasswordCheck("anything")).toBe(false);
  });
});
