import { prisma, type TxClient } from "@/lib/prisma";
import type { NotificationType } from "@/generated/prisma/enums";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

/** Creates notifications inside the caller's transaction (so they commit/rollback with the business change). */
export async function notify(tx: TxClient, inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await tx.notification.createMany({
    data: inputs.map((n) => ({ userId: n.userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null })),
  });
}

export async function listNotifications(userId: string, options: { unreadOnly?: boolean; take?: number } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 50,
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Ownership enforced in the WHERE clause: a user can only mark their own notifications. */
export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return result.count;
}
