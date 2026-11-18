"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, isUniqueConstraintError, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { str } from "@/lib/form-data";
import { formatPrice, toPersianDigits } from "@/lib/utils";
import { bankAccountSchema, markPaidSchema, minWithdrawalSchema, rejectReasonSchema, withdrawalRequestSchema } from "./rules";
import {
  approveWithdrawal,
  cancelWithdrawal,
  markWithdrawalPaid,
  rejectWithdrawal,
  requestWithdrawal,
  saveBankAccount,
  setMinWithdrawal,
} from "./service";

/**
 * Withdrawal Server Actions. Thin: role → id validation → Zod → service. The provider's identity
 * always comes from the session; balances, statuses and bank details are read from the database.
 */

const PROVIDER_PATH = "/dashboard/provider/withdrawals";
const ADMIN_PATH = "/dashboard/admin/withdrawals";

function revalidateAll() {
  revalidatePath("/dashboard", "layout");
}

// ── Provider ────────────────────────────────────────────────────────────────

export async function saveBankAccountAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    const parsed = bankAccountSchema.safeParse({ holderName: str(formData, "holderName"), iban: str(formData, "iban") });
    if (!parsed.success) return fail("اطلاعات حساب بانکی معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    await saveBankAccount(user.id, parsed.data);
    revalidatePath(PROVIDER_PATH);
    return ok(undefined, "اطلاعات حساب بانکی ذخیره شد. درخواست‌های قبلی با همان حساب ثبت‌شده در زمان درخواست پردازش می‌شوند.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestWithdrawalAction(formData: FormData): Promise<ActionResult<{ code: number }>> {
  try {
    const user = await requireRole("PROVIDER");
    const parsed = withdrawalRequestSchema.safeParse({ amount: str(formData, "amount"), clientKey: str(formData, "clientKey") });
    if (!parsed.success) return fail("مبلغ درخواست معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    const created = await requestWithdrawal(user.id, parsed.data);
    revalidateAll();
    return ok(
      { code: created.code },
      created.duplicate
        ? `این درخواست قبلاً با شماره ${toPersianDigits(created.code)} ثبت شده است.`
        : `درخواست برداشت ${formatPrice(created.amount)} با شماره پیگیری ${toPersianDigits(created.code)} ثبت شد و در انتظار بررسی مدیریت است.`,
    );
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelWithdrawalAction(withdrawalId: string): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(withdrawalId)) return fail("درخواست برداشت یافت نشد.");
    await cancelWithdrawal(user.id, withdrawalId);
    revalidateAll();
    return ok(undefined, "درخواست لغو شد و مبلغ آن دوباره قابل برداشت است.");
  } catch (e) {
    return toActionError(e);
  }
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function approveWithdrawalAction(withdrawalId: string): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    if (!isUuid(withdrawalId)) return fail("درخواست برداشت یافت نشد.");
    await approveWithdrawal(admin.id, withdrawalId);
    revalidateAll();
    return ok(undefined, "درخواست تأیید شد. مبلغ همچنان رزرو است تا پس از انتقال بانکی، پرداخت را ثبت کنید.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function rejectWithdrawalAction(withdrawalId: string, reason?: string): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    if (!isUuid(withdrawalId)) return fail("درخواست برداشت یافت نشد.");
    const parsed = rejectReasonSchema.safeParse(reason ?? "");
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "دلیل رد را بنویسید.");
    await rejectWithdrawal(admin.id, withdrawalId, parsed.data);
    revalidateAll();
    return ok(undefined, "درخواست رد شد و مبلغ رزروشده به موجودی قابل برداشت متخصص برگشت.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function markWithdrawalPaidAction(withdrawalId: string, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireRole("ADMIN");
    if (!isUuid(withdrawalId)) return fail("درخواست برداشت یافت نشد.");
    if (str(formData, "confirm") !== "on") {
      return fail("تأیید کنید که انتقال بانکی را خارج از سایت انجام داده‌اید.", { confirm: ["این تأیید الزامی است."] });
    }
    const parsed = markPaidSchema.safeParse({ reference: str(formData, "reference"), note: str(formData, "note") });
    if (!parsed.success) return fail("اطلاعات پرداخت معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    await markWithdrawalPaid(admin.id, withdrawalId, parsed.data);
    revalidateAll();
    return ok(undefined, "پرداخت دستی ثبت شد و مبلغ از کیف پول متخصص کسر شد.");
  } catch (e) {
    if (isUniqueConstraintError(e)) return fail("این کد پیگیری قبلاً برای درخواست دیگری ثبت شده است.", { reference: ["کد پیگیری تکراری است."] });
    return toActionError(e);
  }
}

export async function setMinWithdrawalAction(formData: FormData): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    const parsed = minWithdrawalSchema.safeParse({ minAmount: str(formData, "minAmount") });
    if (!parsed.success) return fail("مبلغ معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    await setMinWithdrawal(parsed.data.minAmount);
    revalidatePath(ADMIN_PATH);
    revalidatePath(PROVIDER_PATH);
    return ok(undefined, parsed.data.minAmount === 0 ? "حداقل مبلغ برداشت حذف شد." : `حداقل مبلغ برداشت ${formatPrice(parsed.data.minAmount)} شد.`);
  } catch (e) {
    return toActionError(e);
  }
}
