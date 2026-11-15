import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCircle2, ClipboardList, PackageCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getCustomerOverview } from "@/features/dashboard/queries";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "پیشخوان مشتری" };

export default async function CustomerDashboardPage() {
  const user = await requireRolePage("CUSTOMER");
  const stats = await getCustomerOverview(user.id);

  return (
    <>
      <PageHeader title={`سلام، ${user.fullName}`} description="خلاصه‌ای از درخواست‌ها و سفارش‌های شما" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="درخواست‌های باز" value={stats.openRequests} icon={ClipboardList} hint={`از ${stats.totalRequests} درخواست`} />
        <StatCard label="سفارش‌های در جریان" value={stats.activeOrders} icon={PackageCheck} />
        <StatCard label="سفارش‌های تکمیل‌شده" value={stats.completedOrders} icon={CheckCircle2} />
        <StatCard label="اعلان‌های خوانده‌نشده" value={stats.unreadNotifications} icon={Bell} />
      </div>

      {stats.totalRequests === 0 ? (
        <EmptyState
          icon={Search}
          title="هنوز درخواستی ثبت نکرده‌اید"
          description="خدمت مورد نیاز خود را انتخاب کنید، فرم کوتاه آن را پر کنید و از متخصصان پیشنهاد قیمت بگیرید."
          action={
            <Button asChild>
              <Link href="/services">ثبت اولین درخواست</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard/customer/requests">مشاهده درخواست‌ها و پیشنهادها</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/customer/orders">پیگیری سفارش‌ها</Link>
          </Button>
        </div>
      )}
    </>
  );
}
