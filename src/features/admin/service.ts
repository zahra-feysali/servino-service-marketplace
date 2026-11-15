import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { recomputeProviderRating } from "@/features/reviews/service";

/** Admin moderation of requests, reviews, broadcast notifications and site settings. */

export async function setRequestFlag(requestId: string, flagged: boolean, reason?: string) {
  const r = await prisma.serviceRequest.updateMany({
    where: { id: requestId },
    data: { isFlagged: flagged, flagReason: flagged ? reason?.trim() || "گزارش‌شده" : null },
  });
  if (r.count === 0) throw new NotFoundError("درخواست یافت نشد.");
}

/** A matched provider reports a problematic request; it is flagged for admin review. */
export async function reportRequestByProvider(providerUserId: string, requestId: string, reason: string) {
  if (!reason.trim()) throw new AppError("دلیل گزارش را بنویسید.", "REASON_REQUIRED");
  const allowed = await prisma.requestMatch.count({ where: { requestId, provider: { userId: providerUserId } } });
  if (!allowed) throw new NotFoundError("درخواست یافت نشد.");
  await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({ where: { id: requestId }, data: { isFlagged: true, flagReason: `گزارش متخصص: ${reason.trim().slice(0, 500)}` } });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await notify(tx, admins.map((a) => ({ userId: a.id, type: "SYSTEM" as const, title: "یک درخواست گزارش شد", link: `/dashboard/admin/requests/${requestId}` })));
  });
}

/** Admin closes an OPEN (e.g. problematic) request; pending offers are rejected and parties notified. */
export async function adminCancelRequest(adminId: string, requestId: string, reason: string) {
  if (!reason.trim()) throw new AppError("دلیل را بنویسید.", "REASON_REQUIRED");
  await prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "ServiceRequest", requestId))) throw new NotFoundError("درخواست یافت نشد.");
    const req = await tx.serviceRequest.findUniqueOrThrow({ where: { id: requestId }, select: { status: true, customerId: true, code: true } });
    if (req.status !== "OPEN") throw new AppError("فقط درخواست باز قابل لغو است؛ سفارش‌ها را از بخش سفارش‌ها مدیریت کنید.", "INVALID_STATE");
    const pending = await tx.providerOffer.findMany({ where: { requestId, status: "PENDING" }, select: { provider: { select: { userId: true } } } });
    await tx.providerOffer.updateMany({ where: { requestId, status: "PENDING" }, data: { status: "REJECTED" } });
    await tx.serviceRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
    await tx.requestStatusHistory.create({ data: { requestId, fromStatus: "OPEN", toStatus: "CANCELLED", changedById: adminId, note: `لغو توسط مدیر: ${reason.trim()}` } });
    await notify(tx, [
      { userId: req.customerId, type: "SYSTEM", title: `درخواست ${req.code} توسط پشتیبانی لغو شد`, body: reason, link: `/dashboard/customer/requests/${requestId}` },
      ...pending.map((p) => ({ userId: p.provider.userId, type: "OFFER_REJECTED" as const, title: `درخواست ${req.code} لغو شد`, link: "/dashboard/provider/offers" })),
    ]);
  });
}

export async function setReviewStatus(reviewId: string, status: "PUBLISHED" | "HIDDEN") {
  await prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: reviewId }, select: { providerId: true } });
    if (!review) throw new NotFoundError("نظر یافت نشد.");
    await tx.review.update({ where: { id: reviewId }, data: { status } });
    await recomputeProviderRating(tx, review.providerId);
  });
}

export const broadcastSchema = z.object({
  audience: z.enum(["ALL", "CUSTOMER", "PROVIDER"]),
  title: z.string().trim().min(3, "عنوان حداقل ۳ کاراکتر است.").max(200),
  body: z.string().trim().max(1000).optional().transform((v) => v || undefined),
});

/** Sends an in-app notification to all active users of an audience. */
export async function broadcastNotification(input: z.output<typeof broadcastSchema>): Promise<number> {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", role: input.audience === "ALL" ? { in: ["CUSTOMER", "PROVIDER"] } : input.audience },
    select: { id: true },
  });
  if (users.length === 0) return 0;
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: "SYSTEM" as const, title: input.title, body: input.body ?? null })) });
  return users.length;
}

// ── Site settings (fixed, typed keys) ─────────────────────────────────────────

export const settingsSchema = z.object({
  "site.name": z.string().trim().min(2).max(60),
  "site.supportPhone": z.string().trim().max(30),
  "site.supportEmail": z.string().trim().max(120).refine((v) => v === "" || z.email().safeParse(v).success, "ایمیل معتبر نیست."),
  "requests.defaultExpiryDays": z.preprocess((v) => Number(v), z.number().int().min(1, "حداقل ۱").max(90, "حداکثر ۹۰")),
});
export type SiteSettings = z.output<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  "site.name": "سروینو",
  "site.supportPhone": "",
  "site.supportEmail": "",
  "requests.defaultExpiryDays": 7,
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) merged[r.key] = r.value;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSiteSettings(data: SiteSettings) {
  await prisma.$transaction(
    Object.entries(data).map(([key, value]) => prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })),
  );
}
