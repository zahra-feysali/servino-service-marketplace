import { prisma } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";
import { AppError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { dashboardPathForRole, type AppRole } from "@/features/auth/rbac";
import { statusAfterMessage, type TicketStatus } from "./rules";

type Category = "GENERAL" | "ACCOUNT" | "ORDER" | "PAYMENT" | "TECHNICAL" | "OTHER";

export async function createTicket(user: { id: string; role: AppRole }, data: { subject: string; category: Category; message: string; orderId: string | null }) {
  if (data.orderId) {
    // The linked order must belong to the user (as customer or as provider).
    const owns = await prisma.order.count({
      where: { id: data.orderId, OR: [{ customerId: user.id }, { provider: { userId: user.id } }] },
    });
    if (!owns) throw new AppError("سفارش انتخاب‌شده معتبر نیست.", "VALIDATION", { orderId: ["سفارش انتخاب‌شده معتبر نیست."] });
  }
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: { userId: user.id, subject: data.subject, category: data.category, orderId: data.orderId, status: "OPEN" },
      select: { id: true, code: true },
    });
    await tx.ticketMessage.create({ data: { ticketId: ticket.id, authorId: user.id, body: data.message, isStaff: false } });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await notify(tx, admins.map((a) => ({ userId: a.id, type: "SYSTEM" as const, title: `تیکت جدید ${ticket.code}: ${data.subject}`, link: `/dashboard/admin/tickets/${ticket.id}` })));
    return ticket;
  });
}

export async function listUserTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, code: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true },
  });
}

const ticketDetailSelect = {
  id: true, code: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true, closedAt: true, userId: true,
  user: { select: { fullName: true, phone: true, role: true } },
  order: { select: { id: true, code: true } },
  messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, isStaff: true, createdAt: true, author: { select: { fullName: true } } } },
} as const;

export async function getTicketForUser(userId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({ where: { id: ticketId, userId }, select: ticketDetailSelect });
}

export async function adminGetTicket(ticketId: string) {
  return prisma.supportTicket.findUnique({ where: { id: ticketId }, select: ticketDetailSelect });
}

export async function adminListTickets(status: TicketStatus | undefined, page = 1) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      ...pageArgs(page),
      select: { id: true, code: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true, user: { select: { fullName: true, role: true } } },
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

/**
 * Adds a message. Users can only reply to their own tickets; staff (admin) can reply to any.
 * A user reply re-opens a closed ticket; status follows `statusAfterMessage`.
 */
export async function replyToTicket(author: { id: string; role: AppRole }, ticketId: string, message: string) {
  const byStaff = author.role === "ADMIN";
  await prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "SupportTicket", ticketId))) throw new NotFoundError("تیکت یافت نشد.");
    const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId }, select: { userId: true, status: true, code: true, user: { select: { role: true } } } });
    if (!byStaff && ticket.userId !== author.id) throw new NotFoundError("تیکت یافت نشد.");
    if (byStaff && ticket.status === "CLOSED") throw new AppError("ابتدا تیکت را باز کنید.", "INVALID_STATE");

    await tx.ticketMessage.create({ data: { ticketId, authorId: author.id, body: message, isStaff: byStaff } });
    await tx.supportTicket.update({ where: { id: ticketId }, data: { status: statusAfterMessage(ticket.status, byStaff), closedAt: null } });

    if (byStaff) {
      await notify(tx, [{
        userId: ticket.userId, type: "TICKET_REPLY", title: `پاسخ پشتیبانی به تیکت ${ticket.code}`,
        link: `${dashboardPathForRole(ticket.user.role)}/tickets/${ticketId}`,
      }]);
    }
  });
}

export async function setTicketClosed(actor: { id: string; role: AppRole }, ticketId: string, closed: boolean) {
  const where = actor.role === "ADMIN" ? { id: ticketId } : { id: ticketId, userId: actor.id };
  const r = await prisma.supportTicket.updateMany({
    where,
    data: closed ? { status: "CLOSED", closedAt: new Date() } : { status: "CUSTOMER_REPLY", closedAt: null },
  });
  if (r.count === 0) throw new NotFoundError("تیکت یافت نشد.");
}

/** Orders a user may link to a ticket. */
export async function listUserOrdersForTickets(userId: string) {
  return prisma.order.findMany({
    where: { OR: [{ customerId: userId }, { provider: { userId } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, code: true, service: { select: { name: true } } },
  });
}
