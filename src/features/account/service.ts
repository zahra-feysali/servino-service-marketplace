import { prisma } from "@/lib/prisma";
import { AppError, isUniqueConstraintError, NotFoundError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/features/auth/password";

export async function getAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, phone: true, email: true, role: true, createdAt: true, lastLoginAt: true },
  });
  if (!user) throw new NotFoundError("حساب کاربری یافت نشد.");
  return user;
}

export async function updateProfile(userId: string, data: { fullName: string; email?: string }) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { fullName: data.fullName, email: data.email ?? null },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("این ایمیل قبلاً ثبت شده است.", "DUPLICATE", { email: ["این ایمیل قبلاً ثبت شده است."] });
    }
    throw error;
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new NotFoundError("حساب کاربری یافت نشد.");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError("رمز عبور فعلی صحیح نیست.", "INVALID_PASSWORD", {
      currentPassword: ["رمز عبور فعلی صحیح نیست."],
    });
  }

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() } });
}
