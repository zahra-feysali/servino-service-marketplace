import type { Metadata } from "next";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { parsePage } from "@/lib/pagination";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { TicketList } from "@/features/tickets/components/ticket-views";
import { TICKET_STATUS_META } from "@/features/tickets/rules";
import { adminListTickets } from "@/features/tickets/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تیکت‌ها" };
const STATUSES = ["OPEN", "CUSTOMER_REPLY", "ANSWERED", "CLOSED"] as const;

export default async function AdminTicketsPage({ searchParams }: PageProps<"/dashboard/admin/tickets">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const raw = sp.status;
  const status = pickParam(raw, STATUSES);
  const tickets = await adminListTickets(status, parsePage(sp.page));
  return (
    <>
    <TicketList
      tickets={tickets.items}
      basePath="/dashboard/admin/tickets"
      showNew={false}
      showUser
      filters={
        <FilterLinks
          basePath="/dashboard/admin/tickets"
          param="status"
          current={status}
          options={[{ value: "", label: "همه" }, ...STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_META[s].label }))]}
        />
      }
    />
    <PaginationNav basePath="/dashboard/admin/tickets" params={sp} page={tickets.page} totalPages={tickets.totalPages} total={tickets.total} />
    </>
  );
}
