import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ClipboardList, CreditCard, Flag, LifeBuoy, PackageCheck, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimpleBarChart, SimplePieChart } from "@/components/shared/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { countFlaggedRequests, getAdminOverview } from "@/features/dashboard/queries";
import { ROLE_LABELS } from "@/features/auth/rbac";
import { ORDER_STATUS_META } from "@/features/orders/labels";
import { getAdminReports } from "@/features/reports/queries";
import { USER_STATUS_LABELS } from "@/features/users/labels";
import { requireRolePage } from "@/lib/authz";

import { formatDate, formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "پیشخوان مدیریت" };

const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "short" });

export default async function AdminDashboardPage() {
  await requireRolePage("ADMIN");
  const [o, r, flagged] = await Promise.all([getAdminOverview(), getAdminReports(), countFlaggedRequests()]);

  return (
    <>
      <PageHeader title="پیشخوان مدیریت" description="نمای کلی و گزارش‌های ۳۰ روز اخیر" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="مشتریان" value={o.customers} icon={Users} />
        <StatCard label="متخصصان" value={o.providers} icon={UserCog} />
        <StatCard label="درخواست‌های باز" value={o.openRequests} icon={ClipboardList} hint={`${r.requests30d.toLocaleString("fa-IR")} درخواست در ۳۰ روز`} />
        <StatCard label="سفارش‌های در جریان" value={o.activeOrders} icon={PackageCheck} />
        <StatCard label="اشتراک‌های فعال" value={o.activeSubscriptions} icon={CreditCard} hint={`درآمد اشتراک ۳۰ روز: ${formatPrice(r.subscriptionRevenue30d)}`} />
        <StatCard label="در انتظار تأیید" value={o.pendingProviders} icon={BadgeCheck} />
        <StatCard label="تیکت‌های باز" value={o.openTickets} icon={LifeBuoy} />
        <StatCard label="درخواست‌های گزارش‌شده" value={flagged} icon={Flag} />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {o.pendingProviders > 0 ? (
          <Link href="/dashboard/admin/providers?verification=PENDING" className="text-primary hover:underline">
            بررسی {o.pendingProviders.toLocaleString("fa-IR")} متخصص در انتظار تأیید ←
          </Link>
        ) : null}
        {flagged > 0 ? (
          <Link href="/dashboard/admin/requests?flagged=1" className="text-primary hover:underline">
            بررسی درخواست‌های گزارش‌شده ←
          </Link>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">درخواست‌های ثبت‌شده (۳۰ روز)</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={r.requestsPerDay.map((d) => ({ label: dayLabel.format(new Date(`${d.date}T12:00:00Z`)), value: d.value }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">درآمد پرداخت‌های موفق (۳۰ روز)</CardTitle>
            <CardDescription>مجموع: {formatPrice(r.totalRevenue30d)} — همه پرداخت‌ها شبیه‌سازی‌شده‌اند</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart format="price" data={r.revenuePerDay.map((d) => ({ label: dayLabel.format(new Date(`${d.date}T12:00:00Z`)), value: d.value }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">سفارش‌ها بر اساس وضعیت</CardTitle>
            <CardDescription>ارزش سفارش‌های تکمیل‌شده در ۳۰ روز: {formatPrice(r.completedOrderValue30d)}</CardDescription>
          </CardHeader>
          <CardContent>
            <SimplePieChart data={r.ordersByStatus.map((s) => ({ label: ORDER_STATUS_META[s.status].label, value: s.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">پرتقاضاترین خدمات</CardTitle>
          </CardHeader>
          <CardContent>
            {r.topServices.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">داده‌ای وجود ندارد.</p>
            ) : (
              <SimpleBarChart data={r.topServices.map((s) => ({ label: s.name, value: s.count }))} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">کاربران اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          {o.recentUsers.length === 0 ? (
            <EmptyState title="کاربری ثبت نشده است" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">نام</TableHead>
                  <TableHead className="text-start">نقش</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">تاریخ عضویت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.recentUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/admin/users/${u.id}`} className="hover:text-primary">
                        {u.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "ACTIVE" ? "secondary" : "destructive"}>{USER_STATUS_LABELS[u.status]}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(u.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
