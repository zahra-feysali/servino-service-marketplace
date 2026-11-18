"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireRole } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { str } from "@/lib/form-data";
import { clientIpFrom, namedLimiter } from "@/lib/rate-limit";
import { contactSchema } from "./schemas";
import { createContactMessage, setContactMessageStatus } from "./service";

/** 5 messages per IP per 10 minutes (in-memory; use a shared store with several instances). */
const contactLimiter = namedLimiter("contact", 5, 10 * 60_000);

export async function submitContactAction(formData: FormData): Promise<ActionResult> {
  try {
    const ip = clientIpFrom(await headers());
    if (!contactLimiter.hit(`contact:${ip}`).allowed) {
      return fail("تعداد پیام‌های ارسالی زیاد است. لطفاً چند دقیقه بعد دوباره تلاش کنید.");
    }
    // Honeypot: real users never fill this hidden field.
    if (str(formData, "website")) return ok(undefined, "پیام شما دریافت شد.");
    const parsed = contactSchema.safeParse({
      name: str(formData, "name"),
      phone: str(formData, "phone"),
      email: str(formData, "email"),
      subject: str(formData, "subject"),
      message: str(formData, "message"),
    });
    if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", z.flattenError(parsed.error).fieldErrors);
    const user = await getCurrentUser().catch(() => null);
    await createContactMessage(parsed.data, user?.id ?? null);
    return ok(undefined, "پیام شما دریافت شد. همکاران ما به‌زودی پاسخ می‌دهند.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function setContactStatusAction(id: string, status: "NEW" | "READ" | "ARCHIVED"): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(id) || !["NEW", "READ", "ARCHIVED"].includes(status)) return fail("درخواست نامعتبر است.");
    await setContactMessageStatus(id, status);
    revalidatePath("/dashboard/admin/contact");
    return ok(undefined, "وضعیت پیام به‌روزرسانی شد.");
  } catch (error) {
    return toActionError(error);
  }
}
