/**
 * Pure finance rules (no I/O): commission math and order-payment eligibility.
 * Money is integer Toman; commission rates are integer basis points (1% = 100 bps).
 */

export const MAX_COMMISSION_BPS = 5_000; // 50%
export const DEFAULT_COMMISSION_BPS = 1_000; // 10%

/** "12.5" % → 1250 bps (rounded to whole basis points). */
export function percentToBps(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) throw new Error("INVALID_RATE");
  const bps = Math.round(percent * 100);
  if (bps > MAX_COMMISSION_BPS) throw new Error("INVALID_RATE");
  return bps;
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Splits a paid amount between the platform (commission) and the provider.
 * Commission is rounded half-up to whole Toman; the provider receives the exact remainder,
 * so commission + provider share always equals the gross amount.
 */
export function computeSplit(grossAmount: number, commissionRateBps: number) {
  if (!Number.isInteger(grossAmount) || grossAmount < 0) throw new Error("INVALID_AMOUNT");
  if (!Number.isInteger(commissionRateBps) || commissionRateBps < 0 || commissionRateBps > MAX_COMMISSION_BPS) {
    throw new Error("INVALID_RATE");
  }
  const commissionAmount = Math.floor((grossAmount * commissionRateBps + 5_000) / 10_000);
  return { grossAmount, commissionRateBps, commissionAmount, providerAmount: grossAmount - commissionAmount };
}

export type PayableOrder = {
  customerId: string;
  status: string;
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
};

export type OrderPaymentError = "NOT_OWNER" | "ALREADY_PAID" | "NOT_PAYABLE";

/** A customer may pay their own unpaid order while it is still active (not completed/cancelled/disputed). */
export function canPayOrder(order: PayableOrder, customerId: string): OrderPaymentError | null {
  if (order.customerId !== customerId) return "NOT_OWNER";
  if (order.paymentStatus !== "UNPAID") return "ALREADY_PAID";
  if (!["PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "IN_PROGRESS", "PROVIDER_COMPLETED"].includes(order.status)) return "NOT_PAYABLE";
  return null;
}

export const ORDER_PAYMENT_ERROR_MESSAGES: Record<OrderPaymentError, string> = {
  NOT_OWNER: "این سفارش متعلق به شما نیست.",
  ALREADY_PAID: "هزینه این سفارش قبلاً پرداخت شده است.",
  NOT_PAYABLE: "این سفارش در وضعیت قابل پرداخت نیست.",
};

/** Work may only start once the customer has paid (funds are held in escrow by the platform). */
export function requiresPaymentBefore(to: string): boolean {
  return to === "IN_PROGRESS" || to === "PROVIDER_COMPLETED" || to === "COMPLETED";
}

/** Settlement state changes allowed from the order lifecycle. */
export function settlementActionFor(orderTo: string): "RELEASE" | "REFUND" | null {
  if (orderTo === "COMPLETED") return "RELEASE";
  if (orderTo === "CANCELLED") return "REFUND";
  return null;
}

export const SETTLEMENT_STATUS_META = {
  HELD: { label: "در انتظار تکمیل سفارش", variant: "outline" },
  RELEASED: { label: "آزادشده", variant: "default" },
  REFUNDED: { label: "بازپرداخت‌شده", variant: "destructive" },
} as const;

export const ORDER_PAYMENT_STATUS_META = {
  UNPAID: { label: "پرداخت‌نشده", variant: "outline" },
  PAID: { label: "پرداخت‌شده (نزد سایت)", variant: "default" },
  REFUNDED: { label: "بازپرداخت‌شده", variant: "destructive" },
} as const;
