import { prisma } from "@/lib/prisma";
import { AppError, isUniqueConstraintError } from "@/lib/errors";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { parseIdentifier, type RegisterData } from "./schemas";
import type { AppRole } from "./rbac";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: AppRole;
};

/**
 * Verifies credentials. Returns null for any failure (unknown user, wrong password,
 * inactive/suspended account) so the caller cannot distinguish cases.
 */
export async function authenticate(identifier: string, password: string): Promise<AuthenticatedUser | null> {
  const parsed = parseIdentifier(identifier);
  if (!parsed) {
    await burnPasswordCheck(password);
    return null;
  }

  const user = await prisma.user.findUnique({
    where: parsed.kind === "email" ? { email: parsed.value } : { phone: parsed.value },
    select: { id: true, fullName: true, email: true, phone: true, role: true, status: true, passwordHash: true },
  });

  if (!user) {
    await burnPasswordCheck(password);
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || user.status !== "ACTIVE") return null;

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { id: user.id, name: user.fullName, email: user.email, phone: user.phone, role: user.role };
}

/**
 * Creates a CUSTOMER or PROVIDER account atomically:
 * User + role profile (+ PENDING-able provider profile in DRAFT) + wallet.
 */
export async function registerUser(data: RegisterData): Promise<{ id: string; role: AppRole }> {
  const passwordHash = await hashPassword(data.password);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email ?? null,
          passwordHash,
          role: data.role,
          status: "ACTIVE",
        },
        select: { id: true, role: true },
      });

      if (data.role === "CUSTOMER") {
        await tx.customerProfile.create({ data: { userId: created.id } });
      } else {
        await tx.providerProfile.create({
          data: {
            userId: created.id,
            displayName: data.displayName?.trim() || data.fullName,
            verificationStatus: "DRAFT",
          },
        });
      }

      await tx.wallet.create({ data: { userId: created.id } });
      return created;
    });

    return user;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const target = JSON.stringify(error.meta?.target ?? "");
      if (target.includes("email")) {
        throw new AppError("این ایمیل قبلاً ثبت شده است.", "DUPLICATE", { email: ["این ایمیل قبلاً ثبت شده است."] });
      }
      throw new AppError("این شماره موبایل قبلاً ثبت شده است.", "DUPLICATE", {
        phone: ["این شماره موبایل قبلاً ثبت شده است."],
      });
    }
    throw error;
  }
}
