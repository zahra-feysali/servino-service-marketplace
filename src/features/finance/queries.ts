import { prisma } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";
import type { SettlementStatus } from "@/generated/prisma/enums";
import { bucketByMonth } from "@/features/reports/aggregate";
import { getCommissionRateBps } from "./service";

type Range = { from?: Date; to?: Date };
const dateWhere = (field: string, r: Range) =>
  r.from || r.to ? { [field]: { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lt: r.to } : {}) } } : {};

/** Platform finance overview for the admin (all simulated money). */
export async function getFinanceSummary(range: Range = {}) {
  const [orderPayments, held, released, refunded, subscription, featured, topups, rate, payouts, reserved] = await Promise.all([
    prisma.payment.aggregate({ where: { purpose: "ORDER", status: "SUCCEEDED", ...dateWhere("paidAt", range) }, _sum: { amount: true }, _count: true }),
    prisma.orderSettlement.aggregate({ where: { status: "HELD", ...dateWhere("heldAt", range) }, _sum: { grossAmount: true, commissionAmount: true, providerAmount: true }, _count: true }),
    prisma.orderSettlement.aggregate({ where: { status: "RELEASED", ...dateWhere("releasedAt", range) }, _sum: { grossAmount: true, commissionAmount: true, providerAmount: true }, _count: true }),
    prisma.orderSettlement.aggregate({ where: { status: "REFUNDED", ...dateWhere("refundedAt", range) }, _sum: { grossAmount: true }, _count: true }),
    prisma.payment.aggregate({ where: { purpose: "SUBSCRIPTION", status: "SUCCEEDED", ...dateWhere("paidAt", range) }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { purpose: "FEATURED_PLACEMENT", status: "SUCCEEDED", ...dateWhere("paidAt", range) }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { purpose: "WALLET_TOPUP", status: "SUCCEEDED", ...dateWhere("paidAt", range) }, _sum: { amount: true } }),
    getCommissionRateBps(),
    // Provider payouts (manual bank transfers recorded by admins) — money leaving provider wallets, not revenue.
    prisma.withdrawalRequest.aggregate({ where: { status: "PAID", ...dateWhere("paidAt", range) }, _sum: { amount: true }, _count: true }),
    prisma.wallet.aggregate({ _sum: { reservedBalance: true } }),
  ]);
  const commissionEarned = released._sum.commissionAmount ?? 0;
  const subscriptionRevenue = subscription._sum.amount ?? 0;
  const featuredRevenue = featured._sum.amount ?? 0;
  return {
    commissionRateBps: rate,
    orderPaymentsTotal: orderPayments._sum.amount ?? 0,
    orderPaymentsCount: orderPayments._count,
    heldGross: held._sum.grossAmount ?? 0,
    heldProvider: held._sum.providerAmount ?? 0,
    heldCommission: held._sum.commissionAmount ?? 0,
    heldCount: held._count,
    releasedProvider: released._sum.providerAmount ?? 0,
    releasedCount: released._count,
    commissionEarned,
    refundedTotal: refunded._sum.grossAmount ?? 0,
    refundedCount: refunded._count,
    subscriptionRevenue,
    featuredRevenue,
    topUpsTotal: topups._sum.amount ?? 0,
    platformRevenue: commissionEarned + subscriptionRevenue + featuredRevenue,
    payoutsTotal: payouts._sum.amount ?? 0,
    payoutsCount: payouts._count,
    withdrawalsReserved: reserved._sum.reservedBalance ?? 0,
  };
}

export async function listSettlements(filter: { status?: SettlementStatus } & Range, page = 1) {
  const where: Prisma.OrderSettlementWhereInput = { ...(filter.status ? { status: filter.status } : {}), ...dateWhere("heldAt", filter) };
  const [items, total] = await Promise.all([
    prisma.orderSettlement.findMany({
      where,
      orderBy: { heldAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, status: true, grossAmount: true, commissionRateBps: true, commissionAmount: true, providerAmount: true,
        heldAt: true, releasedAt: true, refundedAt: true,
        order: { select: { id: true, code: true, service: { select: { name: true } }, customer: { select: { fullName: true } } } },
        provider: { select: { displayName: true } },
        payment: { select: { code: true, gateway: true } },
      },
    }),
    prisma.orderSettlement.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

/** Provider earnings from escrow settlements: released (in wallet) vs. held (awaiting completion). */
export async function getProviderEarnings(providerId: string, now = new Date()) {
  const settlements = await prisma.orderSettlement.findMany({
    where: { providerId },
    orderBy: { heldAt: "desc" },
    select: {
      id: true, status: true, grossAmount: true, commissionAmount: true, providerAmount: true, commissionRateBps: true,
      heldAt: true, releasedAt: true, refundedAt: true,
      order: { select: { id: true, code: true, service: { select: { name: true } }, customer: { select: { fullName: true } } } },
    },
  });
  const released = settlements.filter((s) => s.status === "RELEASED");
  const held = settlements.filter((s) => s.status === "HELD");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    releasedTotal: released.reduce((a, s) => a + s.providerAmount, 0),
    heldTotal: held.reduce((a, s) => a + s.providerAmount, 0),
    commissionTotal: released.reduce((a, s) => a + s.commissionAmount, 0),
    thisMonth: released.filter((s) => s.releasedAt && s.releasedAt >= monthStart).reduce((a, s) => a + s.providerAmount, 0),
    perMonth: bucketByMonth(released.filter((s) => s.releasedAt), (s) => s.releasedAt!, 6, now, (s) => s.providerAmount),
    recent: settlements.slice(0, 30),
  };
}
