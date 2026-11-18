import { prisma } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";
import { parseSnapshot } from "@/features/forms/definitions";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, RequestStatus, ReviewStatus } from "@/generated/prisma/enums";

/** Admin read models for requests, offers, orders and reviews (paginated). ADMIN role is checked by callers. */

type DateRange = { from?: Date; to?: Date };
const createdIn = (r: DateRange) => (r.from || r.to ? { createdAt: { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lt: r.to } : {}) } } : {});

export async function adminListRequests(filter: { status?: RequestStatus; flagged?: boolean; code?: number; cityId?: string } & DateRange, page = 1) {
  const where: Prisma.ServiceRequestWhereInput = {
    ...createdIn(filter),
    ...(filter.cityId ? { cityId: filter.cityId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.flagged ? { isFlagged: true } : {}),
    ...(filter.code ? { code: filter.code } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, code: true, status: true, offerCount: true, isFlagged: true, expiresAt: true, createdAt: true,
        service: { select: { name: true } }, city: { select: { name: true } }, customer: { select: { fullName: true } },
        _count: { select: { matches: true } },
      },
    }),
    prisma.serviceRequest.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function adminGetRequest(id: string) {
  const r = await prisma.serviceRequest.findUnique({
    where: { id },
    select: {
      id: true, code: true, status: true, description: true, addressText: true, preferredDate: true, answers: true, formSnapshot: true,
      formVersion: true, isFlagged: true, flagReason: true, expiresAt: true, createdAt: true, offerCount: true,
      service: { select: { name: true } }, city: { select: { name: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      attachments: { select: { id: true, fieldName: true, fileName: true, mimeType: true, size: true } },
      history: { orderBy: { createdAt: "asc" }, select: { id: true, toStatus: true, note: true, createdAt: true } },
      matches: { select: { provider: { select: { id: true, displayName: true } }, viewedAt: true, createdAt: true } },
      offers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, price: true, estimatedDuration: true, estimatedDurationUnit: true, status: true, description: true, createdAt: true, provider: { select: { id: true, displayName: true } } },
      },
      order: { select: { id: true, code: true, status: true } },
    },
  });
  return r ? { ...r, fields: parseSnapshot(r.formSnapshot) } : null;
}

export async function adminListOffers(status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | undefined, page = 1) {
  const where: Prisma.ProviderOfferWhereInput = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.providerOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, price: true, estimatedDuration: true, estimatedDurationUnit: true, status: true, createdAt: true,
        provider: { select: { displayName: true } },
        request: { select: { id: true, code: true, service: { select: { name: true } } } },
      },
    }),
    prisma.providerOffer.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function adminListOrders(status: OrderStatus | undefined, page = 1, range: DateRange = {}) {
  const where: Prisma.OrderWhereInput = { ...(status ? { status } : {}), ...createdIn(range) };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, code: true, status: true, price: true, createdAt: true, updatedAt: true,
        service: { select: { name: true } }, request: { select: { code: true, city: { select: { name: true } } } },
        provider: { select: { displayName: true } }, customer: { select: { fullName: true } }, review: { select: { id: true } }, paymentStatus: true,
      },
    }),
    prisma.order.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function adminListReviews(status: ReviewStatus | undefined, page = 1) {
  const where: Prisma.ReviewWhereInput = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, rating: true, comment: true, status: true, createdAt: true,
        customer: { select: { fullName: true } },
        provider: { select: { displayName: true } },
        order: { select: { id: true, code: true, service: { select: { name: true } } } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return toPaginated(items, total, page);
}
