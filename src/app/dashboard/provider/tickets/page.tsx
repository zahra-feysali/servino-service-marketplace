import type { Metadata } from "next";
import { TicketList } from "@/features/tickets/components/ticket-views";
import { listUserTickets } from "@/features/tickets/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تیکت‌های پشتیبانی" };

export default async function TicketsPage() {
  const user = await requireRolePage("PROVIDER");
  const tickets = await listUserTickets(user.id);
  return <TicketList tickets={tickets} basePath="/dashboard/provider/tickets" />;
}
