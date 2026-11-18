import { prisma } from "@/lib/prisma";
import { bucketByDay, sum } from "./aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin reports for the last 30 days. Platform revenue = released order commission +
 * subscription payments + featured-placement payments (top-ups and order payments are customer
 * money, not revenue). All payments are simulated.
 */
export async function getAdminReports(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [requests, payments, commissions, ordersByStatus, topServices, completedOrders] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.payment.findMany({
      where: { status: "SUCCEEDED", paidAt: { gte: since }, purpose: { in: ["SUBSCRIPTION", "FEATURED_PLACEMENT"] } },
      select: { paidAt: true, amount: true, purpose: true },
    }),
    prisma.orderSettlement.findMany({ where: { status: "RELEASED", releasedAt: { gte: since } }, select: { releasedAt: true, commissionAmount: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.serviceRequest.groupBy({ by: ["serviceId"], _count: { _all: true }, orderBy: { _count: { serviceId: "desc" } }, take: 5 }),
    prisma.order.findMany({ where: { status: "COMPLETED", completedAt: { gte: since } }, select: { price: true } }),
  ]);
  const serviceNames = await prisma.service.findMany({ where: { id: { in: topServices.map((t) => t.serviceId) } }, select: { id: true, name: true } });

  const revenueRows = [
    ...payments.map((p) => ({ at: p.paidAt!, amount: p.amount })),
    ...commissions.map((c) => ({ at: c.releasedAt!, amount: c.commissionAmount })),
  ];

  return {
    requestsPerDay: bucketByDay(requests, (r) => r.createdAt, 30, now),
    revenuePerDay: bucketByDay(revenueRows, (r) => r.at, 30, now, (r) => r.amount),
    totalRevenue30d: sum(revenueRows.map((r) => r.amount)),
    subscriptionRevenue30d: sum(payments.filter((p) => p.purpose === "SUBSCRIPTION").map((p) => p.amount)),
    commission30d: sum(commissions.map((c) => c.commissionAmount)),
    ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count._all })),
    topServices: topServices.map((t) => ({ name: serviceNames.find((s) => s.id === t.serviceId)?.name ?? "—", count: t._count._all })),
    completedOrderValue30d: sum(completedOrders.map((o) => o.price)),
    requests30d: requests.length,
  };
}
