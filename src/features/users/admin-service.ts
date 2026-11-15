import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { fullNameSchema, phoneSchema } from "@/features/auth/schemas";
import { notify } from "@/features/notifications/service";
import { canReview } from "@/features/providers/verification";

export const adminUserUpdateSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.email().safeParse(v).success, "ایمیل معتبر نیست."),
});

export async function adminListUsers(filter: { role: "CUSTOMER" | "PROVIDER"; q?: string; status?: "ACTIVE" | "INACTIVE" | "SUSPENDED"; verification?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" }) {
  const q = filter.q?.trim();
  return prisma.user.findMany({
    where: {
      role: filter.role,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.verification ? { providerProfile: { verificationStatus: filter.verification } } : {}),
      ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, fullName: true, phone: true, email: true, status: true, createdAt: true, lastLoginAt: true,
      providerProfile: { select: { id: true, displayName: true, verificationStatus: true, ratingAverage: true, ratingCount: true } },
      _count: { select: { requests: true, customerOrders: true } },
    },
  });
}

export async function adminGetUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, phone: true, email: true, role: true, status: true, createdAt: true, lastLoginAt: true,
      providerProfile: { select: { id: true } },
      wallet: { select: { balance: true } },
      _count: { select: { requests: true, customerOrders: true, tickets: true, payments: true } },
    },
  });
}

export async function adminUpdateUser(id: string, data: z.output<typeof adminUserUpdateSchema>) {
  try {
    const r = await prisma.user.updateMany({ where: { id }, data });
    if (r.count === 0) throw new NotFoundError("کاربر یافت نشد.");
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new AppError("موبایل یا ایمیل تکراری است.", "DUPLICATE");
    throw e;
  }
}

/** Activate / deactivate / suspend. Admins cannot change their own status or other admins' status. */
export async function adminSetUserStatus(adminId: string, userId: string, status: "ACTIVE" | "INACTIVE" | "SUSPENDED") {
  if (adminId === userId) throw new ForbiddenError("نمی‌توانید وضعیت حساب خودتان را تغییر دهید.");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw new NotFoundError("کاربر یافت نشد.");
  if (user.role === "ADMIN") throw new ForbiddenError("وضعیت حساب مدیران از این بخش قابل تغییر نیست.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status } });
    const labels = { ACTIVE: "فعال شد", INACTIVE: "غیرفعال شد", SUSPENDED: "مسدود شد" } as const;
    await notify(tx, [{ userId, type: "SYSTEM", title: `حساب کاربری شما ${labels[status]}` }]);
  });
}

export async function adminGetProviderForReview(providerId: string) {
  return prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: {
      id: true, displayName: true, bio: true, yearsOfExperience: true, verificationStatus: true, rejectionReason: true,
      submittedAt: true, reviewedAt: true, ratingAverage: true, ratingCount: true, completedOrdersCount: true,
      reviewedBy: { select: { fullName: true } },
      user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } },
      services: { select: { service: { select: { name: true } } } },
      areas: { select: { city: { select: { name: true } } } },
      skills: { select: { id: true, name: true } },
      portfolio: { select: { id: true, title: true, description: true, imageKey: true } },
      documents: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, title: true, fileName: true, mimeType: true, size: true, status: true, reviewNote: true, createdAt: true } },
    },
  });
}

/** Approves or rejects a PENDING provider profile; pending documents follow the decision. */
export async function adminReviewProvider(adminId: string, providerId: string, decision: "APPROVE" | "REJECT", reason?: string) {
  await prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "ProviderProfile", providerId))) throw new NotFoundError("متخصص یافت نشد.");
    const p = await tx.providerProfile.findUniqueOrThrow({ where: { id: providerId }, select: { verificationStatus: true, userId: true } });
    const error = canReview(p.verificationStatus, decision, reason);
    if (error === "NOT_PENDING") throw new AppError("این پروفایل در انتظار بررسی نیست.", error);
    if (error === "REASON_REQUIRED") throw new AppError("دلیل رد را بنویسید.", error);

    const approved = decision === "APPROVE";
    await tx.providerProfile.update({
      where: { id: providerId },
      data: { verificationStatus: approved ? "APPROVED" : "REJECTED", reviewedAt: new Date(), reviewedById: adminId, rejectionReason: approved ? null : reason!.trim() },
    });
    await tx.providerDocument.updateMany({ where: { providerId, status: "PENDING" }, data: { status: approved ? "APPROVED" : "REJECTED" } });
    await notify(tx, [
      approved
        ? { userId: p.userId, type: "PROVIDER_APPROVED", title: "حساب حرفه‌ای شما تأیید شد", body: "اکنون با داشتن اشتراک فعال، درخواست‌های مرتبط را دریافت می‌کنید.", link: "/dashboard/provider" }
        : { userId: p.userId, type: "PROVIDER_REJECTED", title: "پروفایل حرفه‌ای شما تأیید نشد", body: reason, link: "/dashboard/provider/profile" },
    ]);
  });
}

/** Admin may suspend an approved provider from the marketplace by setting it back to REJECTED with a reason. */
export async function adminRevokeProvider(adminId: string, providerId: string, reason: string) {
  if (!reason.trim()) throw new AppError("دلیل را بنویسید.", "REASON_REQUIRED");
  await prisma.$transaction(async (tx) => {
    const p = await tx.providerProfile.findUnique({ where: { id: providerId }, select: { verificationStatus: true, userId: true } });
    if (!p) throw new NotFoundError();
    if (p.verificationStatus !== "APPROVED") throw new AppError("فقط متخصص تأییدشده قابل لغو تأیید است.", "INVALID_STATE");
    await tx.providerProfile.update({ where: { id: providerId }, data: { verificationStatus: "REJECTED", rejectionReason: reason.trim(), reviewedAt: new Date(), reviewedById: adminId } });
    await notify(tx, [{ userId: p.userId, type: "PROVIDER_REJECTED", title: "تأیید حساب حرفه‌ای شما لغو شد", body: reason, link: "/dashboard/provider/profile" }]);
  });
}

export async function adminSetDocumentStatus(documentId: string, status: "APPROVED" | "REJECTED", note?: string) {
  const r = await prisma.providerDocument.updateMany({ where: { id: documentId }, data: { status, reviewNote: note?.trim() || null } });
  if (r.count === 0) throw new NotFoundError();
}
