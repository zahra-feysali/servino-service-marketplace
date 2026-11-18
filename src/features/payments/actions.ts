"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { num } from "@/lib/form-data";
import { topUpSchema } from "./rules";
import { completeSimulatedPayment, createTopUp } from "./service";

/** Wallet top-up and simulated-gateway settlement — for customers and providers (own payments only). */

export async function createTopUpAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await requireRole("CUSTOMER", "PROVIDER");
    const parsed = topUpSchema.safeParse({ amount: num(formData, "amount") });
    if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    const payment = await createTopUp(user.id, parsed.data.amount);
    return ok({ redirectTo: `/payment/${payment.id}` });
  } catch (e) {
    return toActionError(e);
  }
}

export async function completePaymentAction(paymentId: string, outcome: "SUCCESS" | "FAIL"): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await requireRole("CUSTOMER", "PROVIDER");
    if (!isUuid(paymentId) || (outcome !== "SUCCESS" && outcome !== "FAIL")) return fail("اطلاعات وارد شده معتبر نیست.");
    const r = await completeSimulatedPayment(user.id, paymentId, outcome);
    revalidatePath("/dashboard", "layout");
    const message = r.alreadySettled
      ? "این پرداخت قبلاً تعیین وضعیت شده است؛ تغییری اعمال نشد."
      : r.status === "SUCCEEDED"
        ? "پرداخت (شبیه‌سازی‌شده) موفق بود."
        : "پرداخت ناموفق ثبت شد.";
    return ok({ redirectTo: `/payment/${paymentId}` }, message);
  } catch (e) {
    return toActionError(e);
  }
}
