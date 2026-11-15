import { z } from "zod";

/**
 * Simulated payment rules (pure). No real gateway exists in this version:
 * every payment is stored with gateway SIMULATED or WALLET and `isSimulated = true`.
 * The outcome is always decided and persisted by the server; the browser only asks.
 */

/**
 * Simulated settlement lets the payer choose the outcome, which is only acceptable while no
 * real gateway exists. It is ON by default outside production and must be enabled explicitly
 * in production with ALLOW_SIMULATED_PAYMENTS=true (e.g. for a demo deployment).
 */
export function simulatedPaymentsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ALLOW_SIMULATED_PAYMENTS === "true") return true;
  if (env.ALLOW_SIMULATED_PAYMENTS === "false") return false;
  return env.NODE_ENV !== "production";
}

export const MIN_TOP_UP = 10_000;
export const MAX_TOP_UP = 50_000_000;

export const topUpSchema = z.object({
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,\s٬]/g, "")) : v),
    z
      .number({ error: "مبلغ را وارد کنید." })
      .int("مبلغ باید عدد صحیح (تومان) باشد.")
      .min(MIN_TOP_UP, "حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است.")
      .max(MAX_TOP_UP, "حداکثر مبلغ شارژ ۵۰٬۰۰۰٬۰۰۰ تومان است."),
  ),
});

export type PaymentLike = { userId: string; status: "PENDING" | "SUCCEEDED" | "FAILED"; gateway: "SIMULATED" | "WALLET" };

/** Only the payment's owner may complete it, only once, and only on the simulated gateway page. */
export function canCompleteSimulatedPayment(payment: PaymentLike, userId: string): "NOT_OWNER" | "NOT_PENDING" | "WRONG_GATEWAY" | null {
  if (payment.userId !== userId) return "NOT_OWNER";
  if (payment.status !== "PENDING") return "NOT_PENDING";
  if (payment.gateway !== "SIMULATED") return "WRONG_GATEWAY";
  return null;
}

/** New wallet balance after a debit; throws a typed error code when the balance is insufficient. */
export function walletBalanceAfterDebit(balance: number, amount: number): number {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
  if (balance < amount) throw new Error("INSUFFICIENT_BALANCE");
  return balance - amount;
}

export function walletBalanceAfterCredit(balance: number, amount: number): number {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
  return balance + amount;
}

/** Simulated tracking code shown on receipts (clearly prefixed as simulated). */
export function simulatedTrackingCode(random: () => number = Math.random): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(random() * 10)).join("");
  return `SIM-${digits}`;
}

export const PAYMENT_STATUS_META = {
  PENDING: { label: "در انتظار پرداخت", variant: "outline" },
  SUCCEEDED: { label: "موفق", variant: "default" },
  FAILED: { label: "ناموفق", variant: "destructive" },
} as const;

export const PAYMENT_PURPOSE_LABELS = {
  SUBSCRIPTION: "خرید اشتراک",
  FEATURED_PLACEMENT: "نمایش ویژه",
  WALLET_TOPUP: "شارژ کیف پول",
} as const;

export const PAYMENT_GATEWAY_LABELS = {
  SIMULATED: "درگاه شبیه‌سازی‌شده",
  WALLET: "کیف پول",
} as const;

export const WALLET_REASON_LABELS = {
  TOP_UP: "شارژ کیف پول",
  SUBSCRIPTION_PURCHASE: "خرید اشتراک",
  FEATURED_PURCHASE: "نمایش ویژه",
  ORDER_EARNING: "درآمد سفارش",
  REFUND: "بازگشت وجه",
  ADJUSTMENT: "اصلاح توسط مدیر",
} as const;
