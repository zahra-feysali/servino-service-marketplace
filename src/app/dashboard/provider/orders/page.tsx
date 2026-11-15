import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { listProviderOrders } from "@/features/orders/service";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "سفارش‌های دریافتی" };

export default async function ProviderOrdersPage() {
  const user = await requireRolePage("PROVIDER");
  const profile = await getProviderProfileByUserId(user.id);
  const orders = await listProviderOrders(profile.id);
  return (
    <>
      <PageHeader title="سفارش‌های دریافتی" description="سفارش‌هایی که مشتریان با انتخاب پیشنهاد شما ایجاد کرده‌اند" />
      <OrdersTable orders={orders} basePath="/dashboard/provider/orders" counterpart="customer" />
    </>
  );
}
