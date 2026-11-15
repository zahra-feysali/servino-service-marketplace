import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FlaskConical, ShieldAlert, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { getCurrentUserSafe } from "@/features/auth/current-user-safe";
import { PAYMENT_GATEWAY_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUS_META } from "@/features/payments/rules";
import { getPaymentForUser } from "@/features/payments/service";
import { completePaymentAction } from "@/features/providers/actions";
import { isUuid } from "@/lib/db-locks";
import { formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "درگاه پرداخت شبیه‌سازی‌شده" };

/**
 * Simulated payment gateway. Clearly labelled as a simulation: no bank, card or real money.
 * The outcome chosen here is sent to the server, which validates and records it.
 */
export default async function PaymentPage({ params }: PageProps<"/payment/[id]">) {
  const { id } = await params;
  const user = await getCurrentUserSafe();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/payment/${id}`)}`);
  if (!isUuid(id)) notFound();
  const payment = await getPaymentForUser(user.id, id);
  if (!payment) notFound();

  const meta = PAYMENT_STATUS_META[payment.status];
  const back = payment.purpose === "SUBSCRIPTION" ? "/dashboard/provider/subscription" : "/dashboard/provider/wallet";

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <Alert className="border-warning/50 bg-warning/10">
        <FlaskConical />
        <AlertTitle>درگاه پرداخت شبیه‌سازی‌شده</AlertTitle>
        <AlertDescription>
          این صفحه یک درگاه آزمایشی است؛ هیچ تراکنش بانکی واقعی انجام نمی‌شود و اطلاعات کارت دریافت نمی‌شود.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>پرداخت شماره {toPersianDigits(payment.code)}</span>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </CardTitle>
          <CardDescription>
            {PAYMENT_PURPOSE_LABELS[payment.purpose]}
            {payment.subscription ? ` — ${payment.subscription.plan.name}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">مبلغ</span>
            <span className="text-xl font-bold">{formatPrice(payment.amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">روش</span>
            <span>{PAYMENT_GATEWAY_LABELS[payment.gateway]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">تاریخ ایجاد</span>
            <span>{formatDateTime(payment.createdAt)}</span>
          </div>
          {payment.trackingCode ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">کد پیگیری (آزمایشی)</span>
              <span className="ltr-nums font-mono">{payment.trackingCode}</span>
            </div>
          ) : null}
          {payment.status === "SUCCEEDED" ? (
            <p className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
              <CheckCircle2 className="size-5" aria-hidden />
              پرداخت با موفقیت ثبت شد{payment.paidAt ? ` (${formatDateTime(payment.paidAt)})` : ""}.
            </p>
          ) : null}
          {payment.status === "FAILED" ? (
            <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
              <XCircle className="size-5" aria-hidden />
              {payment.failureReason ?? "پرداخت ناموفق بود."}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {payment.status === "PENDING" && payment.gateway === "SIMULATED" ? (
            <>
              <ActionButton action={completePaymentAction.bind(null, payment.id, "SUCCESS")}>
                <CheckCircle2 />
                شبیه‌سازی پرداخت موفق
              </ActionButton>
              <ActionButton action={completePaymentAction.bind(null, payment.id, "FAIL")} variant="outline">
                <ShieldAlert />
                شبیه‌سازی پرداخت ناموفق
              </ActionButton>
            </>
          ) : (
            <Button asChild variant="outline">
              <Link href={back}>بازگشت به پنل</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
