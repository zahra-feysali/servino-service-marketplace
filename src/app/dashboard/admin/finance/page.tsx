import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpFromLine, BadgeDollarSign, Banknote, FlaskConical, HandCoins, Hourglass, Landmark, Percent, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { StatCard } from "@/components/shared/stat-card";
import { setCommissionRateAction } from "@/features/finance/actions";
import { getFinanceSummary, listSettlements } from "@/features/finance/queries";
import { SETTLEMENT_STATUS_META, bpsToPercent } from "@/features/finance/rules";
import { PAYMENT_GATEWAY_LABELS } from "@/features/payments/rules";
import { requireRolePage } from "@/lib/authz";
import { tehranDateRange } from "@/lib/jalali";
import { parsePage } from "@/lib/pagination";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "مالی و کمیسیون" };
const STATUSES = ["HELD", "RELEASED", "REFUNDED"] as const;

export default async function AdminFinancePage({ searchParams }: PageProps<"/dashboard/admin/finance">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const status = pickParam(sp.status, STATUSES);
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const range = tehranDateRange(from, to);
  const [s, settlements] = await Promise.all([getFinanceSummary(range), listSettlements({ status, ...range }, parsePage(sp.page))]);
  const base = "/dashboard/admin/finance";

  return (
    <>
      <PageHeader icon={Landmark} title="مالی و کمیسیون" description="درآمد سایت، کمیسیون سفارش‌ها، مبالغ نگهداری‌شده و آزادشده، و بازپرداخت‌ها" />
      <Alert>
        <FlaskConical />
        <AlertDescription>درگاه بانکی واقعی متصل نیست؛ تمام مبالغ مربوط به پرداخت‌های شبیه‌سازی‌شده است.</AlertDescription>
      </Alert>

      <DateRangeFilter basePath={base} from={from} to={to} keep={{ status }} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="درآمد کل سایت" value={formatPrice(s.platformRevenue)} icon={Landmark} hint="کمیسیون + اشتراک + نمایش ویژه" />
        <StatCard label="کمیسیون دریافت‌شده" value={formatPrice(s.commissionEarned)} icon={Percent} tone="violet" hint={`${toPersianDigits(s.releasedCount)} سفارش تکمیل‌شده`} />
        <StatCard label="پرداخت سفارش‌ها" value={formatPrice(s.orderPaymentsTotal)} icon={Banknote} hint={`${toPersianDigits(s.orderPaymentsCount)} پرداخت`} />
        <StatCard label="در انتظار تأیید (نزد سایت)" value={formatPrice(s.heldGross)} icon={Hourglass} tone="amber" hint={`سهم متخصصان: ${formatPrice(s.heldProvider)}`} />
        <StatCard label="سهم آزادشده متخصصان" value={formatPrice(s.releasedProvider)} icon={HandCoins} tone="green" />
        <StatCard label="بازپرداخت‌ها (لغو)" value={formatPrice(s.refundedTotal)} icon={RotateCcw} tone="rose" hint={`${toPersianDigits(s.refundedCount)} سفارش`} />
        <StatCard label="درآمد اشتراک" value={formatPrice(s.subscriptionRevenue)} icon={BadgeDollarSign} />
        <StatCard label="درآمد نمایش ویژه" value={formatPrice(s.featuredRevenue)} icon={BadgeDollarSign} tone="amber" />
        <StatCard label="برداشت‌های پرداخت‌شده متخصصان" value={formatPrice(s.payoutsTotal)} icon={ArrowUpFromLine} hint={`${toPersianDigits(s.payoutsCount)} انتقال دستی — درآمد سایت نیست`} />
        <StatCard label="رزرو برای درخواست‌های برداشت" value={formatPrice(s.withdrawalsReserved)} icon={Hourglass} tone="violet" hint="وضعیت فعلی، مستقل از بازه تاریخ" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>نرخ کمیسیون سایت</CardTitle>
            <CardDescription>
              نرخ فعلی: {bpsToPercent(s.commissionRateBps).toLocaleString("fa-IR")}٪ — هنگام پرداخت هر سفارش ثبت و برای همان سفارش ثابت می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServerForm action={setCommissionRateAction} className="flex items-end gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="percent">درصد کمیسیون</FieldLabel>
                <Input id="percent" name="percent" type="number" min={0} max={50} step="0.01" dir="ltr" defaultValue={bpsToPercent(s.commissionRateBps)} />
                <FieldDescription>بین ۰ تا ۵۰ درصد</FieldDescription>
                <FormFieldError name="percent" />
              </Field>
              <SubmitButton className="mb-6">ذخیره</SubmitButton>
            </ServerForm>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>جریان پول هر سفارش</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            <ol className="list-inside list-decimal space-y-1">
              <li>مشتری کل مبلغ سفارش را از کیف پول یا درگاه می‌پردازد؛ مبلغ نزد سایت نگهداری می‌شود.</li>
              <li>نرخ کمیسیون همان لحظه ثبت و سهم سایت و سهم متخصص محاسبه می‌شود.</li>
              <li>پس از تأیید تکمیل سفارش توسط مشتری (یا مدیر در اختلاف)، سهم متخصص به کیف پول او اضافه می‌شود.</li>
              <li>در صورت لغو سفارش، کل مبلغ به کیف پول مشتری بازگردانده می‌شود.</li>
              <li>
                متخصص می‌تواند موجودی کیف پول را با{" "}
                <Link href="/dashboard/admin/withdrawals" className="text-primary hover:underline">
                  درخواست برداشت
                </Link>{" "}
                دریافت کند؛ مدیر انتقال بانکی را دستی انجام می‌دهد و سپس ثبت می‌کند.
              </li>
            </ol>
            <p className="mt-2">
              تاریخچه تمام تراکنش‌ها در{" "}
              <Link href="/dashboard/admin/payments" className="text-primary hover:underline">
                پرداخت‌ها و تراکنش‌ها
              </Link>{" "}
              قابل مشاهده است.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">تسویه سفارش‌ها</h2>
          <FilterLinks
            basePath={base}
            param="status"
            current={status}
            extra={{ from, to }}
            options={[{ value: "", label: "همه" }, ...STATUSES.map((v) => ({ value: v, label: SETTLEMENT_STATUS_META[v].label }))]}
          />
        </div>
        {settlements.items.length === 0 ? (
          <EmptyState title="موردی یافت نشد" />
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>سفارش</TableHead>
                  <TableHead>مشتری / متخصص</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>کمیسیون</TableHead>
                  <TableHead>سهم متخصص</TableHead>
                  <TableHead>روش پرداخت</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/dashboard/admin/orders/${r.order.id}`} className="text-primary hover:underline">
                        {toPersianDigits(r.order.code)}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{r.order.service.name}</span>
                    </TableCell>
                    <TableCell>
                      {r.order.customer.fullName}
                      <span className="block text-xs text-muted-foreground">{r.provider.displayName}</span>
                    </TableCell>
                    <TableCell>{formatPrice(r.grossAmount)}</TableCell>
                    <TableCell>
                      {formatPrice(r.commissionAmount)}
                      <span className="block text-xs text-muted-foreground">{bpsToPercent(r.commissionRateBps).toLocaleString("fa-IR")}٪</span>
                    </TableCell>
                    <TableCell>{formatPrice(r.providerAmount)}</TableCell>
                    <TableCell>
                      {PAYMENT_GATEWAY_LABELS[r.payment.gateway]}
                      <span className="block text-xs text-muted-foreground">پرداخت {toPersianDigits(r.payment.code)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SETTLEMENT_STATUS_META[r.status].variant}>{SETTLEMENT_STATUS_META[r.status].label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.releasedAt ?? r.refundedAt ?? r.heldAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <PaginationNav basePath={base} params={sp} page={settlements.page} totalPages={settlements.totalPages} total={settlements.total} />
      </section>
    </>
  );
}
