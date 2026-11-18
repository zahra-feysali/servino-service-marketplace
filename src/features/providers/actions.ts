"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { num, str, strs } from "@/lib/form-data";
import { reportRequestByProvider } from "@/features/admin/service";
import { purchaseSubscription } from "@/features/subscriptions/service";
import * as profile from "./profile-service";
import { profileInputSchema, skillInputSchema } from "./verification";

/** Provider self-service actions. The profile is always resolved from the session user. */

const INVALID = "اطلاعات وارد شده معتبر نیست.";
const refresh = () => revalidatePath("/dashboard/provider", "layout");

export async function updateProviderProfileAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    const parsed = profileInputSchema.safeParse({ displayName: str(formData, "displayName"), bio: str(formData, "bio"), yearsOfExperience: num(formData, "yearsOfExperience") });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await profile.updateProviderProfile(user.id, parsed.data);
    refresh();
    return ok(undefined, "پروفایل حرفه‌ای ذخیره شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function setProviderServicesAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    const ids = strs(formData, "serviceIds");
    if (!ids.every(isUuid)) return fail(INVALID);
    await profile.setProviderServices(user.id, ids);
    refresh();
    return ok(undefined, "خدمات شما ذخیره شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function setProviderAreasAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    const ids = strs(formData, "cityIds");
    if (!ids.every(isUuid)) return fail(INVALID);
    await profile.setProviderAreas(user.id, ids);
    refresh();
    return ok(undefined, "مناطق خدمت‌رسانی ذخیره شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function addSkillAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    const parsed = skillInputSchema.safeParse({ name: str(formData, "name") });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await profile.addSkill(user.id, parsed.data.name);
    refresh();
    return ok(undefined, "مهارت اضافه شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeSkillAction(skillId: string): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(skillId)) return fail(INVALID);
    await profile.removeSkill(user.id, skillId);
    refresh();
    return ok(undefined, "مهارت حذف شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function removePortfolioItemAction(itemId: string): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(itemId)) return fail(INVALID);
    await profile.removePortfolioItem(user.id, itemId);
    refresh();
    return ok(undefined, "نمونه‌کار حذف شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function removeDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(documentId)) return fail(INVALID);
    await profile.removeProviderDocument(user.id, documentId);
    refresh();
    return ok(undefined, "مدرک حذف شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function submitForVerificationAction(): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    await profile.submitForVerification(user.id);
    refresh();
    return ok(undefined, "پروفایل برای بررسی ارسال شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function reportRequestAction(requestId: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(requestId)) return fail(INVALID);
    await reportRequestByProvider(user.id, requestId, reason ?? "");
    return ok(undefined, "گزارش شما برای بررسی ارسال شد.");
  } catch (e) {
    return toActionError(e);
  }
}

// ── Subscriptions & simulated payments ──────────────────────────────────────

export async function purchaseSubscriptionAction(planId: string, method: "WALLET" | "GATEWAY"): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(planId) || (method !== "WALLET" && method !== "GATEWAY")) return fail(INVALID);
    const r = await purchaseSubscription(user.id, planId, method);
    refresh();
    return r.status === "PENDING"
      ? ok({ redirectTo: `/payment/${r.paymentId}` }, "به درگاه پرداخت شبیه‌سازی‌شده منتقل می‌شوید.")
      : ok({ redirectTo: "/dashboard/provider/subscription" }, "اشتراک با موفقیت خریداری و فعال شد.");
  } catch (e) {
    return toActionError(e);
  }
}
