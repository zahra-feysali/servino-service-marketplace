import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketThread } from "@/features/tickets/components/ticket-views";
import { adminGetTicket } from "@/features/tickets/service";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تیکت" };

export default async function AdminTicketPage({ params }: PageProps<"/dashboard/admin/tickets/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ticket = await adminGetTicket(id);
  if (!ticket) notFound();
  return <TicketThread ticket={ticket} viewerIsStaff orderHref={ticket.order ? `/dashboard/admin/orders/${ticket.order.id}` : undefined} />;
}
