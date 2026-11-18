import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote, BadgeCheck, Hourglass, Landmark, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { UserSearch } from "@/features/users/components/users-table";
import { setMinWithdrawalAction } from "@/features/withdrawals/actions";
import { WithdrawalStatusBadge } from "@/features/withdrawals/components/withdrawal-history";
import { adminListWithdrawals, adminWithdrawalSummary, findWalletLedgerMismatches } from "@/features/withdrawals/queries";
import { WITHDRAWAL_STATUS_META, maskSheba } from "@/features/withdrawals/rules";
import { getMinWithdrawal } from "@/features/withdrawals/service";
import { requireRolePage } from "@/lib/authz";
import { tehranDateRange } from "@/lib/jalali";
import { parsePage } from "@/lib/pagination";
import { formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "درخواست‌های برداشت" };
const STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED", "CANCELLED"] as const;

export default async function AdminWithdrawalsPage({ searchParams }: PageProps<"/dashboard/admin/withdrawals">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const status = pickParam(sp.status, STATUSES);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const base = "/dashboard/admin/withdrawals";
  const [list, s, mismatches, minWithdrawal] = await Promise.all([
    adminListWithdrawals({ status, q, ...tehranDateRange(from, to) }, parsePage(sp.page)),
    adminWithdrawalSummary(),
    findWalletLedgerMismatches(),
    getMinWithdrawal(),
  ]);

  return (
    <>
      <PageHeader icon={Banknote} title="درخواست‌های برداشت" description="بررسی، تأیید، رد و ثبت پرداخت دستی درخواست‌های برداشت متخصصان" />
      <Alert>
        <Landmark />
        <AlertDescription className="leading-7">
          سایت به بانک متصل نیست. پس از تأیید، مبلغ را خودتان از طریق بانک به شبای درخواست منتقل کنید و سپس «ثبت پرداخت دستی» را با کد پیگیری
          انتقال بزنید. برداشت‌ها درآمد سایت محسوب نمی‌شوند.
        </AlertDescription>
      </Alert>

      {mismatches.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>ناهمخوانی دفتر کیف پول</AlertTitle>
          <AlertDescription>
            {toPersianDigits(mismatches.length)} کیف پول با مجموع تراکنش‌ها یا درخواست‌های باز همخوانی ندارد. پیش از پرداخت، موضوع را بررسی کنید.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success">
          <ShieldCheck className="size-4" aria-hidden />
          کنترل دفتر: موجودی همه کیف پول‌ها با تراکنش‌ها و مبالغ رزرو با درخواست‌های باز همخوانی دارد.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="در انتظار بررسی" value={formatPrice(s.pendingAmount)} icon={Hourglass} tone="amber" hint={`${toPersianDigits(s.pendingCount)} درخواست`} />
        <StatCard label="تأییدشده، در انتظار واریز" value={formatPrice(s.approvedAmount)} icon={BadgeCheck} hint={`${toPersianDigits(s.approvedCount)} درخواست`} />
        <StatCard label="کل مبالغ رزروشده" value={formatPrice(s.reservedTotal)} icon={Landmark} tone="violet" hint="در کیف پول متخصصان، غیرقابل خرج" />
        <StatCard label="واریزهای ثبت‌شده" value={formatPrice(s.paidAmount)} icon={Banknote} tone="green" hint={`${toPersianDigits(s.paidCount)} پرداخت دستی`} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <UserSearch basePath={base} q={q} hidden={{ status, from, to }} />
          <p className="text-xs text-muted-foreground">جستجو با نام، نام نمایشی، موبایل متخصص یا شماره درخواست</p>
        </div>
        <Card className="w-full sm:w-80">
          <CardHeader>
            <CardTitle className="text-base">حداقل مبلغ برداشت</CardTitle>
            <CardDescription>{minWithdrawal > 0 ? `فعلی: ${formatPrice(minWithdrawal)}` : "فعلاً بدون حداقل"}</CardDescription>
          </CardHeader>
          <CardContent>
            <ServerForm action={setMinWithdrawalAction} className="flex items-end gap-2">
              <Field className="flex-1">
                <FieldLabel htmlFor="minAmount">مبلغ (تومان)</FieldLabel>
                <Input id="minAmount" name="minAmount" inputMode="numeric" dir="ltr" className="text-left" defaultValue={minWithdrawal} />
                <FieldDescription>۰ یعنی بدون حداقل</FieldDescription>
                <FormFieldError name="minAmount" />
              </Field>
              <SubmitButton className="mb-6">ذخیره</SubmitButton>
            </ServerForm>
          </CardContent>
        </Card>
      </div>

      <DateRangeFilter basePath={base} from={from} to={to} keep={{ status, q }} />
      <FilterLinks
        basePath={base}
        param="status"
        current={status}
        extra={{ q, from, to }}
        options={[{ value: "", label: "همه" }, ...STATUSES.map((v) => ({ value: v, label: WITHDRAWAL_STATUS_META[v].label }))]}
      />

      {list.items.length === 0 ? (
        <EmptyState icon={Banknote} title="درخواستی یافت نشد" description="فیلترها را تغییر دهید یا بعداً دوباره سر بزنید." />
      ) : (
        <div className="rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>شماره</TableHead>
                <TableHead>متخصص</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>شبا</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ درخواست</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{toPersianDigits(w.code)}</TableCell>
                  <TableCell>
                    {w.user.providerProfile?.displayName ?? w.user.fullName}
                    <span className="block text-xs text-muted-foreground" dir="ltr">
                      {w.user.phone}
                    </span>
                    {w.user.status !== "ACTIVE" ? <span className="block text-xs text-destructive">حساب غیرفعال/مسدود</span> : null}
                  </TableCell>
                  <TableCell className="font-bold">{formatPrice(w.amount)}</TableCell>
                  <TableCell dir="ltr" className="text-end font-mono text-xs">
                    {maskSheba(w.ibanSnapshot)}
                  </TableCell>
                  <TableCell>
                    <WithdrawalStatusBadge status={w.status} />
                  </TableCell>
                  <TableCell>{formatDateTime(w.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`${base}/${w.id}`} className="text-sm text-primary hover:underline">
                      بررسی
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationNav basePath={base} params={sp} page={list.page} totalPages={list.totalPages} total={list.total} />
    </>
  );
}
