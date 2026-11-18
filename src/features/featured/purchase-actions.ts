"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { bool, str } from "@/lib/form-data";
import { featuredPlanSchema } from "./purchase-rules";
import { deleteFeaturedPlan, purchaseFeaturedPlan, saveFeaturedPlan } from "./purchase-service";

/** Provider buys a featured plan; the gateway option redirects to the (simulated) payment page. */
export async function purchaseFeaturedPlanAction(planId: string, method: "WALLET" | "GATEWAY"): Promise<ActionResult<{ redirectTo?: string }>> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(planId) || (method !== "WALLET" && method !== "GATEWAY")) return fail("درخواست نامعتبر است.");
    const r = await purchaseFeaturedPlan(user.id, planId, method);
    revalidatePath("/dashboard/provider", "layout");
    if (r.status === "PENDING") return ok({ redirectTo: `/payment/${r.paymentId}` }, "به صفحه پرداخت منتقل می‌شوید.");
    return ok({}, "پلن ویژه خریداری و فعال شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveFeaturedPlanAction(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (id !== null && !isUuid(id)) return fail("درخواست نامعتبر است.");
    const parsed = featuredPlanSchema.safeParse({
      name: str(formData, "name"),
      slug: str(formData, "slug"),
      description: str(formData, "description"),
      placement: str(formData, "placement"),
      durationDays: str(formData, "durationDays"),
      price: str(formData, "price").replace(/[,\s٬]/g, ""),
      sortOrder: str(formData, "sortOrder") || "0",
      isActive: bool(formData, "isActive"),
    });
    if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    await saveFeaturedPlan(id, parsed.data);
    revalidatePath("/dashboard/admin/featured-plans");
    return ok(undefined, id ? "پلن ویژه ویرایش شد." : "پلن ویژه ایجاد شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteFeaturedPlanAction(id: string): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(id)) return fail("درخواست نامعتبر است.");
    const r = await deleteFeaturedPlan(id);
    revalidatePath("/dashboard/admin/featured-plans");
    return ok(undefined, r === "DELETED" ? "پلن حذف شد." : "این پلن خرید داشته است؛ برای حفظ سوابق غیرفعال شد.");
  } catch (error) {
    return toActionError(error);
  }
}
