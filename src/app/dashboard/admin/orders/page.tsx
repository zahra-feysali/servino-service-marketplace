import type { Metadata } from "next";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { adminListOrders } from "@/features/admin/queries";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { ORDER_STATUS_META } from "@/features/orders/labels";
import { ORDER_STATUSES } from "@/features/orders/state-machine";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "سفارش‌ها" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/dashboard/admin/orders">) {
  await requireRolePage("ADMIN");
  const { status: raw } = await searchParams;
  const status = pickParam(raw, ORDER_STATUSES);
  const orders = await adminListOrders(status);
  return (
    <>
      <PageHeader title="سفارش‌ها" description="نظارت بر وضعیت سفارش‌ها و رسیدگی به اختلاف‌ها" />
      <FilterLinks
        basePath="/dashboard/admin/orders"
        param="status"
        current={status}
        options={[{ value: "", label: "همه" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_META[s].label }))]}
      />
      <OrdersTable orders={orders} basePath="/dashboard/admin/orders" counterpart="provider" />
    </>
  );
}
