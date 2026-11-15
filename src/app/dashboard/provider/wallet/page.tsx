import type { Metadata } from "next";
import { FlaskConical, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { PaymentsTable, WalletTransactionsTable } from "@/features/payments/components/payment-tables";
import { getWalletOverview } from "@/features/payments/service";
import { createTopUpAction } from "@/features/providers/actions";
import { requireRolePage } from "@/lib/authz";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "کیف پول و پرداخت‌ها" };

export default async function ProviderWalletPage() {
  const user = await requireRolePage("PROVIDER");
  const w = await getWalletOverview(user.id);

  return (
    <>
      <PageHeader title="کیف پول و پرداخت‌ها" description="شارژ کیف پول، پرداخت اشتراک و سابقه تراکنش‌ها (شبیه‌سازی‌شده)" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Wallet className="size-4" aria-hidden />
              موجودی فعلی
            </CardDescription>
            <CardTitle className="text-3xl">{formatPrice(w.balance)}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start gap-2 text-xs text-muted-foreground">
            <FlaskConical className="size-4 shrink-0" aria-hidden />
            موجودی فقط از طریق پرداخت‌های شبیه‌سازی‌شده شارژ می‌شود و قابل برداشت نیست؛ برای خرید اشتراک استفاده می‌شود.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">شارژ کیف پول</CardTitle>
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
