import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow, lockWallet } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { activateSubscription } from "@/features/subscriptions/service";
import { formatPrice } from "@/lib/utils";
import { canCompleteSimulatedPayment, simulatedTrackingCode, walletBalanceAfterCredit } from "./rules";

/** Creates a PENDING simulated top-up payment for the user's wallet. */
export async function createTopUp(userId: string, amount: number) {
  return prisma.payment.create({
    data: { userId, amount, purpose: "WALLET_TOPUP", status: "PENDING", gateway: "SIMULATED", isSimulated: true },
    select: { id: true },
  });
}

/**
 * Completes a simulated gateway payment. The decision (success/failure) is recorded
 * server-side in one transaction with the payment row locked, so a payment can only
 * be settled once and side effects (subscription activation / wallet credit) happen
 * exactly once together with it.
 */
export async function completeSimulatedPayment(userId: string, paymentId: string, outcome: "SUCCESS" | "FAIL") {
  return prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "Payment", paymentId))) throw new NotFoundError("پرداخت یافت نشد.");
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { id: true, code: true, userId: true, status: true, gateway: true, purpose: true, amount: true, subscriptionId: true },
    });
    const error = canCompleteSimulatedPayment(payment, userId);
    if (error === "NOT_OWNER") throw new ForbiddenError();
    if (error) throw new AppError("این پرداخت قبلاً تعیین وضعیت شده است.", error);

    const link = payment.purpose === "SUBSCRIPTION" ? "/dashboard/provider/subscription" : "/dashboard/provider/wallet";

    if (outcome === "FAIL") {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureReason: "پرداخت در درگاه شبیه‌سازی‌شده ناموفق بود." } });
      if (payment.subscriptionId) {
        await tx.subscription.updateMany({ where: { id: payment.subscriptionId, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      }
      await notify(tx, [{ userId, type: "PAYMENT_FAILED", title: `پرداخت ${payment.code} ناموفق بود`, body: formatPrice(payment.amount), link }]);
      return { status: "FAILED" as const };
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCEEDED", paidAt: new Date(), trackingCode: simulatedTrackingCode() },
    });

    if (payment.purpose === "SUBSCRIPTION") {
      if (!payment.subscriptionId) throw new AppError("اشتراک مرتبط با پرداخت یافت نشد.", "INVALID_STATE");
      await activateSubscription(tx, payment.subscriptionId);
    } else if (payment.purpose === "WALLET_TOPUP") {
      const wallet = await lockWallet(tx, userId);
      const balance = walletBalanceAfterCredit(wallet.balance, payment.amount);
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });
      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: "CREDIT", reason: "TOP_UP", amount: payment.amount, balanceAfter: balance, paymentId, description: "شارژ کیف پول (شبیه‌سازی‌شده)" },
      });
    }

    await notify(tx, [{ userId, type: "PAYMENT_SUCCEEDED", title: `پرداخت ${payment.code} موفق بود`, body: formatPrice(payment.amount), link }]);
    return { status: "SUCCEEDED" as const };
  });
}

export async function getPaymentForUser(userId: string, paymentId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, userId },
    select: {
      id: true, code: true, amount: true, purpose: true, status: true, gateway: true, isSimulated: true, trackingCode: true,
      failureReason: true, paidAt: true, createdAt: true,
      subscription: { select: { plan: { select: { name: true } } } },
    },
  });
}

export async function getWalletOverview(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: {
      balance: true,
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
  return { balance: wallet?.balance ?? 0, transactions: wallet?.transactions ?? [], payments };
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminListPayments(filter: { status?: "PENDING" | "SUCCEEDED" | "FAILED"; purpose?: "SUBSCRIPTION" | "FEATURED_PLACEMENT" | "WALLET_TOPUP" }) {
  return prisma.payment.findMany({
    where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.purpose ? { purpose: filter.purpose } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, code: true, amount: true, purpose: true, status: true, gateway: true, isSimulated: true, trackingCode: true,
      failureReason: true, paidAt: true, createdAt: true, user: { select: { fullName: true, phone: true } },
    },
  });
}

export async function adminListWalletTransactions() {
  return prisma.walletTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, type: true, reason: true, amount: true, balanceAfter: true, description: true, createdAt: true,
      wallet: { select: { user: { select: { fullName: true, phone: true } } } },
      payment: { select: { code: true } },
    },
  });
}
