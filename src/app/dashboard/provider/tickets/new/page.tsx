import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { NewTicketForm } from "@/features/tickets/components/ticket-views";
import { listUserOrdersForTickets } from "@/features/tickets/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تیکت جدید" };

export default async function NewTicketPage() {
  const user = await requireRolePage("PROVIDER");
  const orders = await listUserOrdersForTickets(user.id);
  return (
    <>
      <PageHeader title="ارسال تیکت به پشتیبانی" />
      <NewTicketForm orders={orders} />
    </>
  );
}
