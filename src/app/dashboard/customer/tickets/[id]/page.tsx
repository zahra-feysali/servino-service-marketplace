import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TicketThread } from "@/features/tickets/components/ticket-views";
import { getTicketForUser } from "@/features/tickets/service";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تیکت" };

export default async function TicketPage({ params }: PageProps<"/dashboard/customer/tickets/[id]">) {
  const user = await requireRolePage("CUSTOMER");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const ticket = await getTicketForUser(user.id, id);
  if (!ticket) notFound();
  return <TicketThread ticket={ticket} viewerIsStaff={false} orderHref={ticket.order ? `/dashboard/customer/orders/${ticket.order.id}` : undefined} />;
}
