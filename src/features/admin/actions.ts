"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { bool, num, str } from "@/lib/form-data";
import { featuredInputSchema } from "@/features/featured/rules";
import { createFeatured, deleteFeatured, updateFeatured } from "@/features/featured/service";
import { planInputSchema } from "@/features/subscriptions/lifecycle";
import { deletePlan, savePlan, setPlanActive } from "@/features/subscriptions/plan-service";
import { adminCancelSubscription, adminExtendSubscription, expireDueSubscriptions } from "@/features/subscriptions/service";
import {
  adminReviewProvider,
  adminRevokeProvider,
  adminSetDocumentStatus,
  adminSetUserStatus,
  adminUpdateUser,
  adminUserUpdateSchema,
} from "@/features/users/admin-service";
import { adminCancelRequest, broadcastNotification, broadcastSchema, saveSiteSettings, setRequestFlag, setReviewStatus, settingsSchema } from "./service";

/** Every action in this file requires the ADMIN role (re-checked from the database). */

const INVALID = "اطلاعات وارد شده معتبر نیست.";
const refresh = () => revalidatePath("/dashboard/admin", "layout");

async function run<T>(fn: (adminId: string) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const admin = await requireRole("ADMIN");
    const result = await fn(admin.id);
    if (result.ok) refresh();
    return result;
  } catch (e) {
    return toActionError(e);
  }
}

// ── Users & providers ───────────────────────────────────────────────────────

export async function adminUpdateUserAction(userId: string, formData: FormData) {
  return run(async () => {
    if (!isUuid(userId)) return fail(INVALID);
    const parsed = adminUserUpdateSchema.safeParse({ fullName: str(formData, "fullName"), phone: str(formData, "phone"), email: str(formData, "email") });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await adminUpdateUser(userId, parsed.data);
    return ok(undefined, "اطلاعات کاربر ذخیره شد.");
  });
}

export async function adminSetUserStatusAction(userId: string, status: "ACTIVE" | "INACTIVE" | "SUSPENDED") {
  return run(async (adminId) => {
    if (!isUuid(userId) || !["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) return fail(INVALID);
    await adminSetUserStatus(adminId, userId, status);
    return ok(undefined, "وضعیت حساب تغییر کرد.");
  });
}

export async function adminReviewProviderAction(providerId: string, decision: "APPROVE" | "REJECT", reason?: string) {
  return run(async (adminId) => {
    if (!isUuid(providerId) || (decision !== "APPROVE" && decision !== "REJECT")) return fail(INVALID);
    await adminReviewProvider(adminId, providerId, decision, reason);
    return ok(undefined, decision === "APPROVE" ? "متخصص تأیید شد." : "پروفایل متخصص رد شد.");
  });
}

export async function adminRevokeProviderAction(providerId: string, reason?: string) {
  return run(async (adminId) => {
    if (!isUuid(providerId)) return fail(INVALID);
    await adminRevokeProvider(adminId, providerId, reason ?? "");
    return ok(undefined, "تأیید متخصص لغو شد.");
  });
}

export async function adminSetDocumentStatusAction(documentId: string, status: "APPROVED" | "REJECTED", note?: string) {
  return run(async () => {
    if (!isUuid(documentId) || (status !== "APPROVED" && status !== "REJECTED")) return fail(INVALID);
    await adminSetDocumentStatus(documentId, status, note);
    return ok(undefined, "وضعیت مدرک به‌روزرسانی شد.");
  });
}

// ── Requests & reviews ──────────────────────────────────────────────────────

export async function adminSetRequestFlagAction(requestId: string, flagged: boolean, reason?: string) {
  return run(async () => {
    if (!isUuid(requestId) || typeof flagged !== "boolean") return fail(INVALID);
    await setRequestFlag(requestId, flagged, reason);
    return ok(undefined, flagged ? "درخواست علامت‌گذاری شد." : "علامت مشکل‌دار برداشته شد.");
  });
}

export async function adminCancelRequestAction(requestId: string, reason?: string) {
  return run(async (adminId) => {
    if (!isUuid(requestId)) return fail(INVALID);
    await adminCancelRequest(adminId, requestId, reason ?? "");
    return ok(undefined, "درخواست لغو شد.");
  });
}

export async function adminSetReviewStatusAction(reviewId: string, status: "PUBLISHED" | "HIDDEN") {
  return run(async () => {
    if (!isUuid(reviewId) || (status !== "PUBLISHED" && status !== "HIDDEN")) return fail(INVALID);
    await setReviewStatus(reviewId, status);
    return ok(undefined, status === "HIDDEN" ? "نظر پنهان شد و امتیاز متخصص به‌روزرسانی شد." : "نظر منتشر شد.");
  });
}

// ── Plans & subscriptions ───────────────────────────────────────────────────

export async function adminSavePlanAction(planId: string | null, formData: FormData) {
  return run(async () => {
    if (planId !== null && !isUuid(planId)) return fail(INVALID);
    const parsed = planInputSchema.safeParse({
      name: str(formData, "name"),
      slug: str(formData, "slug"),
      description: str(formData, "description"),
      price: num(formData, "price"),
      durationDays: num(formData, "durationDays"),
      maxRequestsPerPeriod: num(formData, "maxRequestsPerPeriod"),
      maxOffersPerPeriod: num(formData, "maxOffersPerPeriod"),
      features: str(formData, "features"),
      isActive: bool(formData, "isActive"),
      sortOrder: num(formData, "sortOrder"),
    });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await savePlan(planId, parsed.data);
    return ok(undefined, planId ? "پلن به‌روزرسانی شد." : "پلن ایجاد شد.");
  });
}

export async function adminSetPlanActiveAction(planId: string, isActive: boolean) {
  return run(async () => {
    if (!isUuid(planId) || typeof isActive !== "boolean") return fail(INVALID);
    await setPlanActive(planId, isActive);
    return ok(undefined, isActive ? "پلن فعال شد." : "پلن غیرفعال شد.");
  });
}

export async function adminDeletePlanAction(planId: string) {
  return run(async () => {
    if (!isUuid(planId)) return fail(INVALID);
    await deletePlan(planId);
    return ok(undefined, "پلن حذف شد.");
  });
}

export async function adminCancelSubscriptionAction(subscriptionId: string, reason?: string) {
  return run(async (adminId) => {
    if (!isUuid(subscriptionId) || !reason?.trim()) return fail("دلیل را بنویسید.");
    await adminCancelSubscription(adminId, subscriptionId, reason);
    return ok(undefined, "اشتراک لغو شد.");
  });
}

export async function adminExtendSubscriptionAction(subscriptionId: string, formData: FormData) {
  return run(async () => {
    if (!isUuid(subscriptionId)) return fail(INVALID);
    await adminExtendSubscription(subscriptionId, Number(num(formData, "days")));
    return ok(undefined, "اشتراک تمدید شد.");
  });
}

export async function adminExpireSubscriptionsAction() {
  return run(async () => {
    const n = await expireDueSubscriptions();
    return ok(undefined, n > 0 ? `${n.toLocaleString("fa-IR")} اشتراک منقضی شد.` : "اشتراک سررسیدشده‌ای وجود ندارد.");
  });
}

// ── Featured providers ──────────────────────────────────────────────────────

export async function adminSaveFeaturedAction(featuredId: string | null, formData: FormData) {
  return run(async (adminId) => {
    if (featuredId !== null && !isUuid(featuredId)) return fail(INVALID);
    const parsed = featuredInputSchema.safeParse({
      providerId: str(formData, "providerId"),
      placement: str(formData, "placement"),
      startsAt: str(formData, "startsAt"),
      endsAt: str(formData, "endsAt"),
      price: num(formData, "price"),
      sortOrder: num(formData, "sortOrder"),
      isActive: bool(formData, "isActive"),
    });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    if (featuredId) await updateFeatured(featuredId, parsed.data);
    else await createFeatured(adminId, parsed.data);
    revalidatePath("/");
    revalidatePath("/providers");
    return ok(undefined, "نمایش ویژه ذخیره شد.");
  });
}

export async function adminDeleteFeaturedAction(featuredId: string) {
  return run(async () => {
    if (!isUuid(featuredId)) return fail(INVALID);
    await deleteFeatured(featuredId);
    return ok(undefined, "حذف شد.");
  });
}

// ── Notifications & settings ────────────────────────────────────────────────

export async function adminBroadcastAction(formData: FormData) {
  return run(async () => {
    const parsed = broadcastSchema.safeParse({ audience: str(formData, "audience"), title: str(formData, "title"), body: str(formData, "body") });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    const n = await broadcastNotification(parsed.data);
    return ok(undefined, `اعلان برای ${n.toLocaleString("fa-IR")} کاربر ارسال شد.`);
  });
}

export async function adminSaveSettingsAction(formData: FormData) {
  return run(async () => {
    const parsed = settingsSchema.safeParse({
      "site.name": str(formData, "site.name"),
      "site.supportPhone": str(formData, "site.supportPhone"),
      "site.supportEmail": str(formData, "site.supportEmail"),
      "requests.defaultExpiryDays": num(formData, "requests.defaultExpiryDays"),
    });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await saveSiteSettings(parsed.data);
    revalidatePath("/", "layout");
    return ok(undefined, "تنظیمات ذخیره شد.");
  });
}
