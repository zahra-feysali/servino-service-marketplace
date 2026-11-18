import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { pageArgs, toPaginated } from "@/lib/pagination";
import type { ContactInput } from "./schemas";

export async function createContactMessage(input: ContactInput, userId: string | null) {
  return prisma.contactMessage.create({ data: { ...input, userId }, select: { id: true, code: true } });
}

export async function adminListContactMessages(status: "NEW" | "READ" | "ARCHIVED" | undefined, page: number) {
  const where = status ? { status } : { status: { not: "ARCHIVED" as const } };
  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: { id: true, code: true, name: true, phone: true, email: true, subject: true, message: true, status: true, createdAt: true, readAt: true },
    }),
    prisma.contactMessage.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function countNewContactMessages() {
  return prisma.contactMessage.count({ where: { status: "NEW" } });
}

export async function setContactMessageStatus(id: string, status: "NEW" | "READ" | "ARCHIVED") {
  const r = await prisma.contactMessage.updateMany({
    where: { id },
    data: { status, readAt: status === "NEW" ? null : new Date() },
  });
  if (r.count === 0) throw new NotFoundError("پیام یافت نشد.");
}
