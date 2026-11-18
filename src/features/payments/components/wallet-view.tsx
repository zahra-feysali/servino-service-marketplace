import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FlaskConical, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { StatCard } from "@/components/shared/stat-card";
import { createTopUpAction } from "@/features/payments/actions";
import { PaymentsTable, WalletTransactionsTable } from "@/features/payments/components/payment-tables";
import type { getWalletOverview } from "@/features/payments/service";
import { formatPrice } from "@/lib/utils";

type Overview = Awaited<ReturnType<typeof getWalletOverview>>;

/** Wallet page body shared by customers and providers (always the signed-in user's own wallet). */
export function WalletView({ overview: w, role }: { overview: Overview; role: "CUSTOMER" | "PROVIDER" }) {
  const credits = w.transactions.filter((t) => t.type === "CREDIT").reduce((a, t) => a + t.amount, 0);
  const debits = w.transactions.filter((t) => t.type === "DEBIT").reduce((a, t) => a + t.amount, 0);

  return (
    <>
      <PageHeader
        icon={Wallet}
        title="کیف پول و پرداخت‌ها"
        description={
          role === "CUSTOMER"
            ? "شارژ کیف پول، پرداخت سفارش‌ها و سابقه تراکنش‌ها"
            : "سهم آزادشده سفارش‌ها، شارژ کیف پول، پرداخت اشتراک و سابقه تراکنش‌ها"
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="موجودی فعلی"
          value={formatPrice(w.balance)}
          icon={Wallet}
          hint={w.reservedBalance > 0 ? `رزرو برداشت: ${formatPrice(w.reservedBalance)} — قابل استفاده: ${formatPrice(w.balance - w.reservedBalance)}` : undefined}
        />
        <StatCard label="واریزها (۱۰۰ تراکنش اخیر)" value={formatPrice(credits)} icon={ArrowDownLeft} tone="green" />
        <StatCard label="برداشت‌ها (۱۰۰ تراکنش اخیر)" value={formatPrice(debits)} icon={ArrowUpRight} tone="rose" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>شارژ کیف پول</CardTitle>
            <CardDescription>پرداخت از طریق درگاه شبیه‌سازی‌شده انجام می‌شود.</CardDescription>
          </CardHeader>
          <CardContent>
            <ServerForm action={createTopUpAction} className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="amount">مبلغ (تومان)</FieldLabel>
                <Input id="amount" name="amount" inputMode="numeric" dir="ltr" className="text-left" placeholder="500000" required />
                <FieldDescription>بین ۱۰٬۰۰۰ تا ۵۰٬۰۰۰٬۰۰۰ تومان</FieldDescription>
                <FormFieldError name="amount" />
              </Field>
              <SubmitButton className="self-start">ادامه و رفتن به درگاه</SubmitButton>
            </ServerForm>
          </CardContent>
        </Card>
        <Card className="bg-secondary/40">
          <CardContent className="flex items-start gap-3 text-sm leading-7 text-muted-foreground">
            <FlaskConical className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
            <div className="space-y-2">
              <p>
                تمام پرداخت‌های این نسخه <strong className="text-foreground">شبیه‌سازی‌شده</strong> هستند و هیچ وجه واقعی جابه‌جا
                نمی‌شود.
              </p>
              {role === "CUSTOMER" ? (
                <p>با موجودی کیف پول می‌توانید هزینه سفارش‌ها را پرداخت کنید. مبلغ تا تأیید تکمیل کار نزد سایت می‌ماند و در صورت لغو سفارش به کیف پول شما برمی‌گردد.</p>
              ) : (
                <>
                  <p>پس از تأیید تکمیل هر سفارش توسط مشتری، سهم شما (پس از کسر کمیسیون سایت) به این کیف پول اضافه می‌شود.</p>
                  <p>
                    برای انتقال موجودی به حساب بانکی، از بخش{" "}
                    <Link href="/dashboard/provider/withdrawals" className="text-primary hover:underline">
                      برداشت و تسویه
                    </Link>{" "}
                    درخواست ثبت کنید؛ واریز به‌صورت دستی توسط مدیریت انجام می‌شود.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">تراکنش‌های کیف پول</h2>
        <WalletTransactionsTable transactions={w.transactions} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">پرداخت‌ها</h2>
        <PaymentsTable payments={w.payments} linkToGateway />
      </section>
    </>
  );
}
