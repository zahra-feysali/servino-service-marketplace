import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, CalendarDays, PackageCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimpleBarChart } from "@/components/shared/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { getProviderEarnings } from "@/features/reports/queries";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "درآمد" };

const monthLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "short", year: "2-digit" });

export default async function ProviderEarningsPage() {
  const user = await requireRolePage("PROVIDER");
  const profile = await getProviderProfileByUserId(user.id);
  const e = await getProviderEarnings(profile.id);

  return (
    <>
      <PageHeader title="درآمد" description="مجموع مبالغ سفارش‌های تکمیل‌شده (پرداخت هزینه خدمت مستقیماً بین مشتری و متخصص انجام می‌شود)." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="درآمد کل" value={formatPrice(e.total)} icon={BadgeDollarSign} />
        <StatCard label="درآمد این ماه" value={formatPrice(e.thisMonth)} icon={CalendarDays} />
        <StatCard label="سفارش‌های تکمیل‌شده" value={e.count} icon={PackageCheck} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">درآمد ۶ ماه اخیر</CardTitle>
          <CardDescription>بر اساس تاریخ تکمیل سفارش</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart format="price" data={e.perMonth.map((m) => ({ label: monthLabel.format(new Date(`${m.month}-15T00:00:00Z`)), value: m.value }))} />
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">آخرین سفارش‌های تکمیل‌شده</h2>
        {e.recent.length === 0 ? (
          <EmptyState title="هنوز سفارش تکمیل‌شده‌ای ندارید" />
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">سفارش</TableHead>
                  <TableHead className="text-start">خدمت</TableHead>
                  <TableHead className="text-start">مشتری</TableHead>
                  <TableHead className="text-start">مبلغ</TableHead>
                  <TableHead className="text-start">تاریخ تکمیل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.recent.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/dashboard/provider/orders/${o.id}`} className="text-primary hover:underline">
                        {toPersianDigits(o.code)}
                      </Link>
                    </TableCell>
                    <TableCell>{o.service.name}</TableCell>
                    <TableCell>{o.customer.fullName}</TableCell>
                    <TableCell>{formatPrice(o.price)}</TableCell>
                    <TableCell>{o.completedAt ? formatDate(o.completedAt) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </>
  );
}
