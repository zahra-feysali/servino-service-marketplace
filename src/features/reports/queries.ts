import { prisma } from "@/lib/prisma";
import { bucketByDay, bucketByMonth, sum } from "./aggregate";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Admin reports: activity and simulated revenue over the last 30 days + distributions. */
export async function getAdminReports(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [requests, payments, ordersByStatus, topServices, completedOrders] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.payment.findMany({ where: { status: "SUCCEEDED", paidAt: { gte: since } }, select: { paidAt: true, amount: true, purpose: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.serviceRequest.groupBy({ by: ["serviceId"], _count: { _all: true }, orderBy: { _count: { serviceId: "desc" } }, take: 5 }),
    prisma.order.findMany({ where: { status: "COMPLETED", completedAt: { gte: since } }, select: { price: true } }),
  ]);
  const serviceNames = await prisma.service.findMany({ where: { id: { in: topServices.map((t) => t.serviceId) } }, select: { id: true, name: true } });

  return {
    requestsPerDay: bucketByDay(requests, (r) => r.createdAt, 30, now),
    revenuePerDay: bucketByDay(payments, (p) => p.paidAt!, 30, now, (p) => p.amount),
    totalRevenue30d: sum(payments.map((p) => p.amount)),
    subscriptionRevenue30d: sum(payments.filter((p) => p.purpose === "SUBSCRIPTION").map((p) => p.amount)),
    ordersByStatus: ordersByStatus.map((o) => ({ status: o.status, count: o._count._all })),
    topServices: topServices.map((t) => ({ name: serviceNames.find((s) => s.id === t.serviceId)?.name ?? "—", count: t._count._all })),
    completedOrderValue30d: sum(completedOrders.map((o) => o.price)),
    requests30d: requests.length,
  };
}

/**
 * Provider earnings = value of COMPLETED orders (customers pay providers directly for the
 * service; the platform only charges subscriptions). Monthly series for the last 6 months.
 */
export async function getProviderEarnings(providerId: string, now = new Date()) {
  const completed = await prisma.order.findMany({
    where: { providerId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true, code: true, price: true, completedAt: true, service: { select: { name: true } }, customer: { select: { fullName: true } } },
  });
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    total: sum(completed.map((o) => o.price)),
    thisMonth: sum(completed.filter((o) => o.completedAt && o.completedAt >= monthStart).map((o) => o.price)),
    count: completed.length,
    perMonth: bucketByMonth(completed.filter((o) => o.completedAt), (o) => o.completedAt!, 6, now, (o) => o.price),
    recent: completed.slice(0, 20),
  };
}
