import { afterAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/**
 * Registration/login against a real PostgreSQL database (migrated with `prisma migrate dev`).
 * Uses unique phone numbers per run and removes the created rows afterwards.
 */
describe.skipIf(!DB_AVAILABLE)("auth service (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { authenticate, registerUser } = await import("@/features/auth/service");
  const { registerSchema } = await import("@/features/auth/schemas");

  const suffix = String(Date.now()).slice(-8);
  const customerPhone = `091${suffix}`;
  const providerPhone = `093${suffix}`;

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { phone: { in: [customerPhone, providerPhone] } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  const input = (role: "CUSTOMER" | "PROVIDER", phone: string) =>
    registerSchema.parse({
      role,
      fullName: "کاربر آزمایشی",
      phone,
      password: "Secret123",
      confirmPassword: "Secret123",
      acceptTerms: true,
    });

  it("registers a customer with profile and wallet in one transaction", async () => {
    const user = await registerUser(input("CUSTOMER", customerPhone));
    expect(user.role).toBe("CUSTOMER");
    const full = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { customerProfile: true, wallet: true, providerProfile: true },
    });
    expect(full.customerProfile).not.toBeNull();
    expect(full.wallet?.balance).toBe(0);
    expect(full.providerProfile).toBeNull();
    expect(full.passwordHash).not.toBe("Secret123");
  });

  it("registers a provider in DRAFT verification status", async () => {
    const user = await registerUser(input("PROVIDER", providerPhone));
    const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.verificationStatus).toBe("DRAFT");
  });

  it("rejects duplicate phone numbers", async () => {
    await expect(registerUser(input("CUSTOMER", customerPhone))).rejects.toThrow("این شماره موبایل قبلاً ثبت شده است.");
  });

  it("authenticates with correct credentials only", async () => {
    expect(await authenticate(customerPhone, "Secret123")).toMatchObject({ role: "CUSTOMER", phone: customerPhone });
    expect(await authenticate(customerPhone, "Wrong1234")).toBeNull();
    expect(await authenticate("09999999999", "Secret123")).toBeNull();
  });

  it("refuses login for suspended accounts", async () => {
    await prisma.user.update({ where: { phone: customerPhone }, data: { status: "SUSPENDED" } });
    expect(await authenticate(customerPhone, "Secret123")).toBeNull();
  });
});
