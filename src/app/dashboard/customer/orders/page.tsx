import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { listCustomerOrders } from "@/features/orders/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "سفارش‌های من" };

export default async function CustomerOrdersPage() {
  const user = await requireRolePage("CUSTOMER");
  const orders = await listCustomerOrders(user.id);
  return (
    <>
      <PageHeader title="سفارش‌های من" description="پیگیری وضعیت سفارش‌ها" />
      <OrdersTable orders={orders} basePath="/dashboard/customer/orders" counterpart="provider" />
    </>
  );
}
