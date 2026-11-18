import type { Metadata } from "next";
import Link from "next/link";
import { BadgeDollarSign, CalendarDays, Hourglass, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SimpleBarChart } from "@/components/shared/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SETTLEMENT_STATUS_META, bpsToPercent } from "@/features/finance/rules";
import { getProviderEarnings } from "@/features/finance/queries";
import { getProviderProfileByUserId } from "@/features/providers/service";
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
      <PageHeader
        icon={BadgeDollarSign}
        title="درآمد و تسویه"
        description="سهم شما از هر سفارش (پس از کسر کمیسیون سایت) تا تأیید تکمیل کار نزد سایت نگهداری و سپس به کیف پول شما اضافه می‌شود."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="آزادشده (در کیف پول)" value={formatPrice(e.releasedTotal)} icon={BadgeDollarSign} tone="green" />
        <StatCard label="در انتظار تکمیل سفارش" value={formatPrice(e.heldTotal)} icon={Hourglass} tone="amber" />
        <StatCard label="آزادشده این ماه" value={formatPrice(e.thisMonth)} icon={CalendarDays} />
        <StatCard label="کمیسیون کسرشده" value={formatPrice(e.commissionTotal)} icon={Percent} tone="violet" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>درآمد آزادشده در ۶ ماه اخیر</CardTitle>
          <CardDescription>بر اساس تاریخ تأیید تکمیل سفارش</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart format="price" data={e.perMonth.map((m) => ({ label: monthLabel.format(new Date(`${m.month}-15T00:00:00Z`)), value: m.value }))} />
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">تسویه سفارش‌ها</h2>
        {e.recent.length === 0 ? (
          <EmptyState title="هنوز سفارش پرداخت‌شده‌ای ندارید" description="پس از پرداخت هزینه سفارش توسط مشتری، اطلاعات آن اینجا نمایش داده می‌شود." />
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>سفارش</TableHead>
                  <TableHead>خدمت</TableHead>
                  <TableHead>مبلغ سفارش</TableHead>
                  <TableHead>کمیسیون</TableHead>
                  <TableHead>سهم شما</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {e.recent.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/dashboard/provider/orders/${s.order.id}`} className="text-primary hover:underline">
                        {toPersianDigits(s.order.code)}
                      </Link>
                    </TableCell>
                    <TableCell>{s.order.service.name}</TableCell>
                    <TableCell>{formatPrice(s.grossAmount)}</TableCell>
                    <TableCell>
                      {formatPrice(s.commissionAmount)}
                      <span className="block text-xs text-muted-foreground">{bpsToPercent(s.commissionRateBps).toLocaleString("fa-IR")}٪</span>
                    </TableCell>
                    <TableCell className="font-semibold">{formatPrice(s.providerAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={SETTLEMENT_STATUS_META[s.status].variant}>{SETTLEMENT_STATUS_META[s.status].label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(s.releasedAt ?? s.refundedAt ?? s.heldAt)}</TableCell>
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
