import { prisma } from "@/lib/prisma";

/** All queries are scoped to the given user id — callers pass the id from the server session only. */

export async function getCustomerOverview(userId: string) {
  const [openRequests, totalRequests, activeOrders, completedOrders, unreadNotifications] = await Promise.all([
    prisma.serviceRequest.count({ where: { customerId: userId, status: "OPEN" } }),
    prisma.serviceRequest.count({ where: { customerId: userId } }),
    prisma.order.count({
      where: {
        customerId: userId,
        status: { in: ["PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "IN_PROGRESS", "PROVIDER_COMPLETED"] },
      },
    }),
    prisma.order.count({ where: { customerId: userId, status: "COMPLETED" } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { openRequests, totalRequests, activeOrders, completedOrders, unreadNotifications };
}

export async function getProviderOverview(userId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      displayName: true,
      verificationStatus: true,
      rejectionReason: true,
      ratingAverage: true,
      ratingCount: true,
      completedOrdersCount: true,
      _count: { select: { services: true, areas: true, offers: true } },
    },
  });
  if (!profile) return null;

  const now = new Date();
  const [activeSubscription, activeOrders, receivedRequests, wallet] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE", endsAt: { gt: now } },
      orderBy: { endsAt: "desc" },
      select: { endsAt: true, plan: { select: { name: true } } },
    }),
    prisma.order.count({
      where: { providerId: profile.id, status: { in: ["PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "IN_PROGRESS"] } },
    }),
    prisma.requestMatch.count({ where: { providerId: profile.id } }),
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
  ]);

  return { profile, activeSubscription, activeOrders, receivedRequests, walletBalance: wallet?.balance ?? 0 };
}

export async function getAdminOverview() {
  const [customers, providers, pendingProviders, openRequests, activeOrders, activeSubscriptions, openTickets] =
    await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.user.count({ where: { role: "PROVIDER" } }),
      prisma.providerProfile.count({ where: { verificationStatus: "PENDING" } }),
      prisma.serviceRequest.count({ where: { status: "OPEN" } }),
      prisma.order.count({
        where: { status: { in: ["PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "IN_PROGRESS", "PROVIDER_COMPLETED"] } },
      }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
    ]);

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { id: true, fullName: true, role: true, status: true, createdAt: true },
  });

  return {
    customers,
    providers,
    pendingProviders,
    openRequests,
    activeOrders,
    activeSubscriptions,
    openTickets,
    recentUsers,
  };
}
