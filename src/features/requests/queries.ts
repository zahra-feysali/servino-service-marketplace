import { prisma } from "@/lib/prisma";
import { parseSnapshot } from "@/features/forms/definitions";
import type { RequestStatus } from "@/generated/prisma/enums";

/** Every query is scoped by the caller's id in the WHERE clause (ownership enforced in SQL). */

export async function getActiveCitiesGrouped() {
  return prisma.province.findMany({
    where: { isActive: true, cities: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      cities: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
    },
  });
}

export async function listCustomerRequests(customerId: string, status?: RequestStatus) {
  return prisma.serviceRequest.findMany({
    where: { customerId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      code: true,
      status: true,
      offerCount: true,
      createdAt: true,
      expiresAt: true,
      service: { select: { name: true } },
      city: { select: { name: true } },
      order: { select: { id: true, status: true } },
    },
  });
}

export async function getCustomerRequestDetail(customerId: string, requestId: string) {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, customerId },
    select: {
      id: true,
      code: true,
      status: true,
      description: true,
      addressText: true,
      preferredDate: true,
      answers: true,
      formSnapshot: true,
      formVersion: true,
      expiresAt: true,
      createdAt: true,
      service: { select: { name: true, slug: true } },
      city: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" }, select: { id: true, fieldName: true, fileName: true, mimeType: true, size: true } },
      history: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true } },
      order: { select: { id: true, code: true, status: true } },
      offers: {
        where: { status: { not: "WITHDRAWN" } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          price: true,
          estimatedDuration: true,
          estimatedDurationUnit: true,
          description: true,
          notes: true,
          status: true,
          createdAt: true,
          provider: {
            select: {
              id: true,
              userId: true,
              displayName: true,
              user: { select: { avatarUpdatedAt: true } },
              ratingAverage: true,
              ratingCount: true,
              completedOrdersCount: true,
              yearsOfExperience: true,
            },
          },
        },
      },
    },
  });
  if (!request) return null;
  return { ...request, fields: parseSnapshot(request.formSnapshot) };
}

/** Provider inbox: only requests the provider was matched to. */
export async function listProviderInbox(providerId: string, filter: "open" | "all") {
  const now = new Date();
  return prisma.requestMatch.findMany({
    where: {
      providerId,
      ...(filter === "open"
        ? { request: { status: "OPEN", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      viewedAt: true,
      createdAt: true,
      request: {
        select: {
          id: true,
          code: true,
          status: true,
          offerCount: true,
          expiresAt: true,
          createdAt: true,
          service: { select: { name: true } },
          city: { select: { name: true } },
          offers: { where: { providerId }, select: { id: true, status: true, price: true } },
        },
      },
    },
  });
}

/**
 * Request detail for a provider. Access requires a RequestMatch (or an existing offer).
 * The customer's address and contact data are NOT included here — they are revealed
 * only to the selected provider through the order.
 */
export async function getProviderRequestDetail(providerId: string, requestId: string) {
  const request = await prisma.serviceRequest.findFirst({
    where: {
      id: requestId,
      OR: [{ matches: { some: { providerId } } }, { offers: { some: { providerId } } }],
    },
    select: {
      id: true,
      code: true,
      status: true,
      description: true,
      preferredDate: true,
      answers: true,
      formSnapshot: true,
      expiresAt: true,
      createdAt: true,
      offerCount: true,
      service: { select: { name: true } },
      city: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" }, select: { id: true, fieldName: true, fileName: true, mimeType: true, size: true } },
      offers: {
        where: { providerId },
        select: {
          id: true,
          price: true,
          estimatedDuration: true,
          estimatedDurationUnit: true,
          description: true,
          notes: true,
          status: true,
          createdAt: true,
          order: { select: { id: true } },
        },
      },
    },
  });
  if (!request) return null;
  return { ...request, fields: parseSnapshot(request.formSnapshot), myOffer: request.offers[0] ?? null };
}

export async function markMatchViewed(providerId: string, requestId: string) {
  await prisma.requestMatch.updateMany({ where: { providerId, requestId, viewedAt: null }, data: { viewedAt: new Date() } });
}

/**
 * Attachment access check: the request's customer, an admin, or a provider who was
 * matched to / made an offer on the request.
 */
export async function getAttachmentForUser(user: { id: string; role: "CUSTOMER" | "PROVIDER" | "ADMIN" }, attachmentId: string) {
  const attachment = await prisma.requestAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      storageKey: true,
      fileName: true,
      mimeType: true,
      request: { select: { id: true, customerId: true } },
    },
  });
  if (!attachment) return null;
  if (user.role === "ADMIN" || attachment.request.customerId === user.id) return attachment;
  if (user.role === "PROVIDER") {
    const allowed = await prisma.serviceRequest.count({
      where: {
        id: attachment.request.id,
        OR: [{ matches: { some: { provider: { userId: user.id } } } }, { offers: { some: { provider: { userId: user.id } } } }],
      },
    });
    if (allowed > 0) return attachment;
  }
  return null;
}
