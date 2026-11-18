import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { deleteStoredFiles, saveFile } from "@/lib/storage";
import { readValidatedFile } from "@/lib/uploads";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { avatarSrc } from "@/features/avatars/rules";
import { toPersianDigits } from "@/lib/utils";
import {
  CHAT_FILE_MAX_BYTES,
  CHAT_MIME_TYPES,
  CHAT_PAGE_SIZE,
  MAX_CHAT_FILES,
  chatSideFor,
  chatState,
  conversationPath,
  validateMessageContent,
  type ChatSide,
} from "./rules";

type Actor = { id: string; role: "CUSTOMER" | "PROVIDER" | "ADMIN" };

const conversationSelect = {
  id: true,
  requestId: true,
  providerId: true,
  customerId: true,
  lastMessageAt: true,
  provider: { select: { userId: true, displayName: true, user: { select: { avatarUpdatedAt: true } } } },
  customer: { select: { fullName: true, avatarUpdatedAt: true } },
  request: {
    select: {
      code: true,
      status: true,
      service: { select: { name: true } },
      order: { select: { id: true, code: true, status: true, providerId: true } },
    },
  },
} as const;

/**
 * Loads a conversation for one of its two participants. Anyone else (including other providers
 * and admins) gets "not found", so conversation ids cannot be probed.
 */
export async function getConversationForUser(actor: Actor, conversationId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: conversationSelect });
  if (!conv) throw new NotFoundError("گفتگو یافت نشد.");
  const side = chatSideFor(actor.id, { customerId: conv.customerId, providerUserId: conv.provider.userId });
  if (!side || side !== actor.role) throw new NotFoundError("گفتگو یافت نشد.");

  const offer = await prisma.providerOffer.findUnique({
    where: { requestId_providerId: { requestId: conv.requestId, providerId: conv.providerId } },
    select: { status: true },
  });
  const order = conv.request.order && conv.request.order.providerId === conv.providerId ? conv.request.order : null;
  const state = chatState({ offerStatus: offer?.status ?? null, requestStatus: conv.request.status, orderStatus: order?.status ?? null });
  const counterpart =
    side === "CUSTOMER"
      ? { name: conv.provider.displayName, avatarUrl: avatarSrc(conv.provider.userId, conv.provider.user.avatarUpdatedAt) }
      : { name: conv.customer.fullName, avatarUrl: avatarSrc(conv.customerId, conv.customer.avatarUpdatedAt) };
  return { conv, side, state, order, counterpart };
}

/**
 * Opens (or reuses) the conversation for a request + provider. Requires an offer from that
 * provider on that request; the customer must own the request, the provider must own the offer.
 */
export async function startConversation(actor: Actor, requestId: string, providerProfileId?: string) {
  let providerId: string;
  if (actor.role === "PROVIDER") {
    const profile = await prisma.providerProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!profile) throw new ForbiddenError();
    providerId = profile.id;
  } else if (actor.role === "CUSTOMER") {
    if (!providerProfileId) throw new AppError("متخصص مشخص نشده است.", "VALIDATION");
    providerId = providerProfileId;
  } else {
    throw new ForbiddenError();
  }

  const offer = await prisma.providerOffer.findUnique({
    where: { requestId_providerId: { requestId, providerId } },
    select: { request: { select: { customerId: true } } },
  });
  if (!offer) throw new NotFoundError("گفتگو فقط پس از ارسال پیشنهاد امکان‌پذیر است.");
  if (actor.role === "CUSTOMER" && offer.request.customerId !== actor.id) throw new NotFoundError("گفتگو یافت نشد.");

  const conv = await prisma.conversation.upsert({
    where: { requestId_providerId: { requestId, providerId } },
    update: {},
    create: { requestId, providerId, customerId: offer.request.customerId },
    select: { id: true },
  });
  return { conversationId: conv.id, path: conversationPath(actor.role as ChatSide, conv.id) };
}

const messageSelect = {
  id: true,
  senderId: true,
  body: true,
  readAt: true,
  createdAt: true,
  attachments: { select: { id: true, fileName: true, mimeType: true, size: true }, orderBy: { createdAt: "asc" as const } },
} as const;

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  attachments: { id: string; fileName: string; mimeType: string; size: number }[];
};

const serialize = (m: { id: string; senderId: string; body: string | null; readAt: Date | null; createdAt: Date; attachments: ChatMessage["attachments"] }): ChatMessage => ({
  ...m,
  readAt: m.readAt?.toISOString() ?? null,
  createdAt: m.createdAt.toISOString(),
});

/** Sends a text and/or file message. Files are validated by magic bytes and removed if the DB write fails. */
export async function sendMessage(actor: Actor, conversationId: string, body: string | null, files: File[]): Promise<ChatMessage> {
  const { conv, side, state } = await getConversationForUser(actor, conversationId);
  if (!state.canSend) throw new AppError(state.reason, "CHAT_CLOSED");
  const contentError = validateMessageContent(body, files.length);
  if (contentError) throw new AppError(contentError, "VALIDATION", { body: [contentError] });
  if (files.length > MAX_CHAT_FILES) throw new AppError("تعداد فایل‌ها بیش از حد مجاز است.", "VALIDATION");

  const prepared = [];
  for (const f of files) prepared.push(await readValidatedFile(f, CHAT_MIME_TYPES, CHAT_FILE_MAX_BYTES));

  const keys: string[] = [];
  try {
    const stored: { fileName: string; mimeType: string; size: number; storageKey: string }[] = [];
    for (const f of prepared) {
      const key = await saveFile(f.bytes, f.mime);
      keys.push(key);
      stored.push({ fileName: f.fileName, mimeType: f.mime, size: f.size, storageKey: key });
    }
    const recipientId = side === "CUSTOMER" ? conv.provider.userId : conv.customerId;
    const recipientSide: ChatSide = side === "CUSTOMER" ? "PROVIDER" : "CUSTOMER";
    const link = conversationPath(recipientSide, conv.id);
    const senderName = side === "CUSTOMER" ? conv.customer.fullName : conv.provider.displayName;

    return await prisma.$transaction(async (tx) => {
      // Serialises concurrent sends per conversation (keeps lastMessageAt and notification dedupe consistent).
      await lockRow(tx, "Conversation", conv.id);
      const message = await tx.message.create({
        data: { conversationId: conv.id, senderId: actor.id, body, attachments: { create: stored } },
        select: messageSelect,
      });
      await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: message.createdAt } });
      // One unread "new message" notification per conversation is enough (no spam while chatting).
      const pending = await tx.notification.count({ where: { userId: recipientId, type: "NEW_MESSAGE", link, readAt: null } });
      if (pending === 0) {
        await notify(tx, [
          {
            userId: recipientId,
            type: "NEW_MESSAGE",
            title: `پیام جدید از ${senderName}`,
            body: `درخواست ${toPersianDigits(conv.request.code)} — ${conv.request.service.name}`,
            link,
          },
        ]);
      }
      return serialize(message);
    });
  } catch (e) {
    await deleteStoredFiles(keys);
    throw e;
  }
}

/**
 * Messages of a conversation (newest page, or only those after `after` for polling).
 * Reading marks the counterpart's messages and the related notification as read.
 */
export async function readMessages(actor: Actor, conversationId: string, opts: { after?: Date; before?: Date } = {}) {
  const { conv } = await getConversationForUser(actor, conversationId);
  const now = new Date();
  const marked = await prisma.message.updateMany({
    where: { conversationId: conv.id, senderId: { not: actor.id }, readAt: null },
    data: { readAt: now },
  });
  if (marked.count > 0) {
    await prisma.notification.updateMany({
      where: { userId: actor.id, type: "NEW_MESSAGE", readAt: null, link: { endsWith: `/messages/${conv.id}` } },
      data: { readAt: now },
    });
  }

  const where = {
    conversationId: conv.id,
    ...(opts.after ? { createdAt: { gt: opts.after } } : opts.before ? { createdAt: { lt: opts.before } } : {}),
  };
  const rows = await prisma.message.findMany({ where, orderBy: { createdAt: "desc" }, take: CHAT_PAGE_SIZE + 1, select: messageSelect });
  const hasMore = !opts.after && rows.length > CHAT_PAGE_SIZE;
  const page = rows.slice(0, CHAT_PAGE_SIZE).reverse().map(serialize);

  // Latest moment the counterpart read my messages → drives the "seen" ticks on the client.
  const lastRead = await prisma.message.findFirst({
    where: { conversationId: conv.id, senderId: actor.id, readAt: { not: null } },
    orderBy: { readAt: "desc" },
    select: { readAt: true },
  });
  return { messages: page, hasMore, counterpartReadAt: lastRead?.readAt?.toISOString() ?? null };
}

/** Conversations of a user with last message preview and unread counts (newest activity first). */
export async function listConversations(actor: Actor, take = 50) {
  if (actor.role === "ADMIN") return [];
  const where =
    actor.role === "CUSTOMER" ? { customerId: actor.id } : { provider: { userId: actor.id } };
  const convs = await prisma.conversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take,
    select: {
      ...conversationSelect,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, senderId: true, createdAt: true, _count: { select: { attachments: true } } } },
    },
  });
  const unread = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: convs.map((c) => c.id) }, senderId: { not: actor.id }, readAt: null },
    _count: { _all: true },
  });
  const unreadBy = new Map(unread.map((u) => [u.conversationId, u._count._all]));
  return convs.map((c) => {
    const side: ChatSide = actor.role === "CUSTOMER" ? "CUSTOMER" : "PROVIDER";
    const last = c.messages[0] ?? null;
    return {
      id: c.id,
      path: conversationPath(side, c.id),
      lastMessageAt: c.lastMessageAt,
      requestCode: c.request.code,
      serviceName: c.request.service.name,
      counterpart:
        side === "CUSTOMER"
          ? { name: c.provider.displayName, avatarUrl: avatarSrc(c.provider.userId, c.provider.user.avatarUpdatedAt) }
          : { name: c.customer.fullName, avatarUrl: avatarSrc(c.customerId, c.customer.avatarUpdatedAt) },
      lastMessage: last
        ? { mine: last.senderId === actor.id, body: last.body, attachments: last._count.attachments, createdAt: last.createdAt }
        : null,
      unread: unreadBy.get(c.id) ?? 0,
    };
  });
}

export async function countUnreadMessages(userId: string): Promise<number> {
  return prisma.message.count({
    where: {
      senderId: { not: userId },
      readAt: null,
      conversation: { OR: [{ customerId: userId }, { provider: { userId } }] },
    },
  });
}

/** Conversation id for a request + provider if it already exists (for "open chat" buttons). */
export async function findConversationId(requestId: string, providerId: string) {
  const c = await prisma.conversation.findUnique({ where: { requestId_providerId: { requestId, providerId } }, select: { id: true } });
  return c?.id ?? null;
}

/** Attachment for a participant only (null otherwise). */
export async function getChatAttachment(actor: Actor, attachmentId: string) {
  const a = await prisma.messageAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      fileName: true,
      mimeType: true,
      storageKey: true,
      message: { select: { conversation: { select: { customerId: true, provider: { select: { userId: true } } } } } },
    },
  });
  if (!a) return null;
  const c = a.message.conversation;
  if (!chatSideFor(actor.id, { customerId: c.customerId, providerUserId: c.provider.userId })) return null;
  return { fileName: a.fileName, mimeType: a.mimeType, storageKey: a.storageKey };
}
