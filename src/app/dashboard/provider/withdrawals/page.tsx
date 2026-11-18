import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CheckCircle2, Hourglass, Info, Landmark, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { StatCard } from "@/components/shared/stat-card";
import { saveBankAccountAction } from "@/features/withdrawals/actions";
import { ProviderWithdrawalHistory } from "@/features/withdrawals/components/withdrawal-history";
import { WithdrawalRequestForm } from "@/features/withdrawals/components/withdrawal-request-form";
import { getProviderWithdrawalPage } from "@/features/withdrawals/queries";
import { bankNameFromSheba, formatSheba, maskSheba } from "@/features/withdrawals/rules";
import { requireRolePage } from "@/lib/authz";
import { parsePage } from "@/lib/pagination";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "برداشت و تسویه" };

export default async function ProviderWithdrawalsPage({ searchParams }: PageProps<"/dashboard/provider/withdrawals">) {
  const user = await requireRolePage("PROVIDER");
  const sp = await searchParams;
  const { balances: b, bankAccount, minWithdrawal, history } = await getProviderWithdrawalPage(user.id, parsePage(sp.page));
  const base = "/dashboard/provider/withdrawals";

  return (
    <>
      <PageHeader icon={Banknote} title="برداشت و تسویه" description="ثبت حساب بانکی، درخواست برداشت از کیف پول و پیگیری واریزها" />

      <Alert>
        <Info />
        <AlertDescription className="leading-7">
          واریز به حساب بانکی <strong>به‌صورت دستی توسط مدیریت</strong> و خارج از سایت انجام می‌شود؛ سایت به هیچ بانکی متصل نیست و پولی را
          خودکار منتقل نمی‌کند. مبلغ هر درخواست تا تعیین تکلیف رزرو می‌شود و قابل خرج یا برداشت دوباره نیست.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="موجودی کل کیف پول" value={formatPrice(b.balance)} icon={Wallet} hint="شامل مبالغ رزروشده" />
        <StatCard label="قابل برداشت" value={formatPrice(b.available)} icon={CheckCircle2} tone="green" hint="موجودی کل منهای مبالغ رزروشده" />
        <StatCard
          label="رزرو برای درخواست‌های باز"
          value={formatPrice(b.reserved)}
          icon={Hourglass}
          tone="amber"
          hint={`${toPersianDigits(b.openCount)} درخواست در انتظار بررسی یا واریز`}
        />
        <StatCard label="مجموع برداشت‌های پرداخت‌شده" value={formatPrice(b.paidTotal)} icon={Banknote} tone="violet" hint={`${toPersianDigits(b.paidCount)} واریز`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>درخواست برداشت</CardTitle>
            <CardDescription>
              {bankAccount
                ? "مبلغ را وارد کنید؛ پیش از ثبت، حساب مقصد را بازبینی می‌کنید."
                : "برای درخواست برداشت، ابتدا اطلاعات حساب بانکی خود را ثبت کنید."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bankAccount ? (
              <WithdrawalRequestForm
                available={b.available}
                minWithdrawal={minWithdrawal}
                destination={{ holderName: bankAccount.holderName, maskedIban: maskSheba(bankAccount.iban), bankName: bankNameFromSheba(bankAccount.iban) }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">فرم «حساب بانکی تسویه» را تکمیل کنید.</p>
            )}
            {bankAccount && b.available <= 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                موجودی قابل برداشت ندارید. سهم شما از هر سفارش پس از تأیید تکمیل آن توسط مشتری به کیف پول اضافه می‌شود (
                <Link href="/dashboard/provider/earnings" className="text-primary hover:underline">
                  درآمد
                </Link>
                ).
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-primary" aria-hidden />
              حساب بانکی تسویه
            </CardTitle>
            <CardDescription>
              {bankAccount ? (
                <>
                  حساب فعلی: <span dir="ltr" className="font-mono">{formatSheba(bankAccount.iban)}</span>
                  {bankNameFromSheba(bankAccount.iban) ? ` — ${bankNameFromSheba(bankAccount.iban)}` : ""} (به‌روزرسانی {formatDate(bankAccount.updatedAt)})
                </>
              ) : (
                "شماره شبا و نام صاحب حساب را وارد کنید. حساب باید به نام خود شما باشد."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServerForm action={saveBankAccountAction} className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="holderName">نام صاحب حساب</FieldLabel>
                <Input id="holderName" name="holderName" defaultValue={bankAccount?.holderName ?? user.fullName} maxLength={120} required />
                <FormFieldError name="holderName" />
              </Field>
              <Field>
                <FieldLabel htmlFor="iban">شماره شبا</FieldLabel>
                <Input
                  id="iban"
                  name="iban"
                  dir="ltr"
                  className="text-left font-mono"
                  placeholder="IR000000000000000000000000"
                  defaultValue={bankAccount?.iban ?? ""}
                  autoComplete="off"
                  maxLength={40}
                  required
                />
                <FieldDescription>۲۴ رقم پس از IR؛ فاصله و خط تیره مهم نیست. صحت شماره با رقم کنترلی بررسی می‌شود.</FieldDescription>
                <FormFieldError name="iban" />
              </Field>
              <p className="text-xs leading-6 text-muted-foreground">
                تغییر حساب روی درخواست‌های ثبت‌شده اثری ندارد؛ هر درخواست با حسابی پردازش می‌شود که هنگام ثبت آن معتبر بوده است. رمز کارت، CVV2 یا
                اطلاعات بانکداری اینترنتی هرگز از شما خواسته نمی‌شود.
              </p>
              <SubmitButton className="self-start">{bankAccount ? "به‌روزرسانی حساب" : "ثبت حساب"}</SubmitButton>
            </ServerForm>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">سابقه درخواست‌های برداشت</h2>
        <ProviderWithdrawalHistory rows={history.items} />
        <PaginationNav basePath={base} params={sp} page={history.page} totalPages={history.totalPages} total={history.total} />
      </section>
    </>
  );
}
