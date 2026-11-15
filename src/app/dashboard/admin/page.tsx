import type { Metadata } from "next";
import { BadgeCheck, ClipboardList, CreditCard, LifeBuoy, PackageCheck, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getAdminOverview } from "@/features/dashboard/queries";
import { ROLE_LABELS } from "@/features/auth/rbac";
import { USER_STATUS_LABELS } from "@/features/users/labels";
import { requireRolePage } from "@/lib/authz";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "پیشخوان مدیریت" };

export default async function AdminDashboardPage() {
  await requireRolePage("ADMIN");
  const o = await getAdminOverview();

  return (
    <>
      <PageHeader title="پیشخوان مدیریت" description="نمای کلی وضعیت سامانه" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="مشتریان" value={o.customers} icon={Users} />
        <StatCard label="متخصصان" value={o.providers} icon={UserCog} hint={`${o.pendingProviders.toLocaleString("fa-IR")} در انتظار تأیید`} />
        <StatCard label="درخواست‌های باز" value={o.openRequests} icon={ClipboardList} />
        <StatCard label="سفارش‌های در جریان" value={o.activeOrders} icon={PackageCheck} />
        <StatCard label="اشتراک‌های فعال" value={o.activeSubscriptions} icon={CreditCard} />
        <StatCard label="متخصصان در انتظار تأیید" value={o.pendingProviders} icon={BadgeCheck} />
        <StatCard label="تیکت‌های باز" value={o.openTickets} icon={LifeBuoy} />
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
                    <TableCell className="font-medium">{u.fullName}</TableCell>
                    <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "ACTIVE" ? "secondary" : "destructive"}>
                        {USER_STATUS_LABELS[u.status]}
                      </Badge>
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
