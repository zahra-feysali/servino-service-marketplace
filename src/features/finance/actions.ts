"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { num } from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { COMMISSION_SETTING_KEY, payOrderWithWallet, startOrderGatewayPayment } from "./service";
import { percentToBps } from "./rules";

/** Customer pays their own order from the wallet. */
export async function payOrderWithWalletAction(orderId: string): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER");
    if (!isUuid(orderId)) return fail("سفارش یافت نشد.");
    await payOrderWithWallet(user.id, orderId);
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "هزینه سفارش از کیف پول پرداخت شد و تا تکمیل کار نزد سایت نگهداری می‌شود.");
  } catch (e) {
    return toActionError(e);
  }
}

/** Customer pays their own order through the (simulated) gateway. */
export async function startOrderGatewayPaymentAction(orderId: string): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await requireRole("CUSTOMER");
    if (!isUuid(orderId)) return fail("سفارش یافت نشد.");
    const { paymentId } = await startOrderGatewayPayment(user.id, orderId);
    return ok({ redirectTo: `/payment/${paymentId}` });
  } catch (e) {
    return toActionError(e);
  }
}

const commissionSchema = z.object({
  percent: z.preprocess((v) => (v === "" ? NaN : Number(v)), z.number({ error: "درصد را وارد کنید." }).min(0, "حداقل ۰").max(50, "حداکثر ۵۰ درصد")),
});

/** Admin sets the platform commission. Applies only to orders paid from now on (rates are frozen per order). */
export async function setCommissionRateAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    const parsed = commissionSchema.safeParse({ percent: num(formData, "percent") });
    if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    const bps = percentToBps(parsed.data.percent);
    await prisma.siteSetting.upsert({ where: { key: COMMISSION_SETTING_KEY }, update: { value: bps }, create: { key: COMMISSION_SETTING_KEY, value: bps } });
    revalidatePath("/dashboard/admin", "layout");
    return ok(undefined, "نرخ کمیسیون به‌روزرسانی شد. این نرخ فقط برای پرداخت‌های جدید اعمال می‌شود.");
  } catch (e) {
    return toActionError(e);
  }
}
