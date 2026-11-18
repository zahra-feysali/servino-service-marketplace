import { prisma } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { applyOrderPayment } from "@/features/finance/service";
import { activateFeaturedPurchase } from "@/features/featured/purchase-service";
import { creditWallet } from "@/features/finance/wallet";
import { notify } from "@/features/notifications/service";
import { activateSubscription } from "@/features/subscriptions/service";
import { formatPrice } from "@/lib/utils";
import { canCompleteSimulatedPayment, simulatedPaymentsEnabled, simulatedTrackingCode } from "./rules";

/** Creates a PENDING simulated top-up payment for the user's wallet. */
export async function createTopUp(userId: string, amount: number) {
  if (!simulatedPaymentsEnabled()) {
    throw new AppError("درگاه پرداخت شبیه‌سازی‌شده در این محیط غیرفعال است.", "SIMULATION_DISABLED");
  }
  return prisma.payment.create({
    data: { userId, amount, purpose: "WALLET_TOPUP", status: "PENDING", gateway: "SIMULATED", isSimulated: true },
    select: { id: true },
  });
}

/** Where the payer should look after a payment of this purpose (role-aware). */
function paymentLink(purpose: string, role: string): string {
  const base = role === "PROVIDER" ? "/dashboard/provider" : "/dashboard/customer";
  if (purpose === "SUBSCRIPTION") return "/dashboard/provider/subscription";
  if (purpose === "FEATURED_PLACEMENT") return "/dashboard/provider/featured";
  if (purpose === "ORDER") return `${base}/orders`;
  return `${base}/wallet`;
}

/**
 * Gateway-independent settlement of a PENDING payment. This is the single entry point for
 * deciding a payment's outcome: the simulated gateway page calls it today; a real gateway
 * callback/verify route can call it later without changing the finance logic.
 *
 * - Runs in one transaction with the payment row locked.
 * - Idempotent: if the payment is already settled, nothing is applied again and the current
 *   status is returned (protects against duplicate callbacks / double clicks).
 * - Side effects happen exactly once together with the status change: subscription activation,
 *   wallet top-up credit, or order payment (escrow settlement).
 */
export async function settlePayment(paymentId: string, outcome: "SUCCESS" | "FAIL", opts: { expectedUserId?: string; gatewayRef?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "Payment", paymentId))) throw new NotFoundError("پرداخت یافت نشد.");
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: {
        id: true, code: true, userId: true, status: true, gateway: true, purpose: true, amount: true, subscriptionId: true, orderId: true, featuredProviderId: true,
        user: { select: { role: true } },
      },
    });
    if (opts.expectedUserId && payment.userId !== opts.expectedUserId) throw new ForbiddenError();
    if (payment.status !== "PENDING") return { status: payment.status, alreadySettled: true as const };

    const link = paymentLink(payment.purpose, payment.user.role);

    if (outcome === "FAIL") {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureReason: "پرداخت در درگاه ناموفق بود." } });
      if (payment.subscriptionId) {
        await tx.subscription.updateMany({ where: { id: payment.subscriptionId, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      }
      await notify(tx, [{ userId: payment.userId, type: "PAYMENT_FAILED", title: `پرداخت ${payment.code} ناموفق بود`, body: formatPrice(payment.amount), link }]);
      return { status: "FAILED" as const, alreadySettled: false as const };
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCEEDED", paidAt: new Date(), trackingCode: opts.gatewayRef ?? simulatedTrackingCode() },
    });

    if (payment.purpose === "SUBSCRIPTION") {
      if (!payment.subscriptionId) throw new AppError("اشتراک مرتبط با پرداخت یافت نشد.", "INVALID_STATE");
      await activateSubscription(tx, payment.subscriptionId);
    } else if (payment.purpose === "WALLET_TOPUP") {
      await creditWallet(tx, payment.userId, payment.amount, "TOP_UP", { paymentId, description: "شارژ کیف پول (شبیه‌سازی‌شده)" });
    } else if (payment.purpose === "ORDER") {
      if (!payment.orderId) throw new AppError("سفارش مرتبط با پرداخت یافت نشد.", "INVALID_STATE");
      await applyOrderPayment(tx, payment.orderId, payment);
    } else if (payment.purpose === "FEATURED_PLACEMENT") {
      if (!payment.featuredProviderId) throw new AppError("جایگاه ویژه مرتبط با پرداخت یافت نشد.", "INVALID_STATE");
      await activateFeaturedPurchase(tx, payment.featuredProviderId);
    }

    await notify(tx, [{ userId: payment.userId, type: "PAYMENT_SUCCEEDED", title: `پرداخت ${payment.code} موفق بود`, body: formatPrice(payment.amount), link }]);
    return { status: "SUCCEEDED" as const, alreadySettled: false as const };
  });
}

/**
 * The simulated gateway page: only the payer can decide the outcome, only for SIMULATED payments,
 * and only when simulated payments are enabled (development, or explicitly allowed).
 */
export async function completeSimulatedPayment(userId: string, paymentId: string, outcome: "SUCCESS" | "FAIL") {
  if (!simulatedPaymentsEnabled()) {
    throw new AppError("درگاه پرداخت شبیه‌سازی‌شده در این محیط غیرفعال است.", "SIMULATION_DISABLED");
  }
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { userId: true, status: true, gateway: true } });
  if (!payment) throw new NotFoundError("پرداخت یافت نشد.");
  const error = canCompleteSimulatedPayment(payment, userId);
  if (error === "NOT_OWNER") throw new ForbiddenError();
  if (error === "WRONG_GATEWAY") throw new AppError("این پرداخت از درگاه شبیه‌سازی‌شده نیست.", error);
  // NOT_PENDING falls through: settlePayment is idempotent and reports the current status.
  return settlePayment(paymentId, outcome, { expectedUserId: userId });
}

export async function getPaymentForUser(userId: string, paymentId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, userId },
    select: {
      id: true, code: true, amount: true, purpose: true, status: true, gateway: true, isSimulated: true, trackingCode: true,
      failureReason: true, paidAt: true, createdAt: true,
      subscription: { select: { plan: { select: { name: true } } } },
      order: { select: { id: true, code: true } },
      user: { select: { role: true } },
    },
  });
}

export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
  return wallet?.balance ?? 0;
}

export async function getWalletOverview(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      balance: true,
      reservedBalance: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, type: true, reason: true, amount: true, balanceAfter: true, description: true, createdAt: true },
      },
    },
  });
  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, code: true, amount: true, purpose: true, status: true, gateway: true, trackingCode: true, createdAt: true },
  });
  return { balance: wallet?.balance ?? 0, reservedBalance: wallet?.reservedBalance ?? 0, transactions: wallet?.transactions ?? [], payments };
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminListPayments(
  filter: { status?: "PENDING" | "SUCCEEDED" | "FAILED"; purpose?: "SUBSCRIPTION" | "FEATURED_PLACEMENT" | "WALLET_TOPUP" | "ORDER"; from?: Date; to?: Date },
  page = 1,
) {
  const where: Prisma.PaymentWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.purpose ? { purpose: filter.purpose } : {}),
    ...(filter.from || filter.to ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lt: filter.to } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, code: true, amount: true, purpose: true, status: true, gateway: true, isSimulated: true, trackingCode: true,
        failureReason: true, paidAt: true, createdAt: true, user: { select: { fullName: true, phone: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function adminListWalletTransactions(page = 1) {
  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, type: true, reason: true, amount: true, balanceAfter: true, description: true, createdAt: true,
        wallet: { select: { user: { select: { fullName: true, phone: true } } } },
        payment: { select: { code: true } },
      },
    }),
    prisma.walletTransaction.count(),
  ]);
  return toPaginated(items, total, page);
}
