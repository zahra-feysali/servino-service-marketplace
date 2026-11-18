import type { Metadata } from "next";
import Link from "next/link";
import { Check, CreditCard, FlaskConical, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getWalletOverview } from "@/features/payments/service";
import { purchaseSubscriptionAction } from "@/features/providers/actions";
import { SUBSCRIPTION_STATUS_META } from "@/features/subscriptions/lifecycle";
import { parsePlanSnapshot, remainingOffers, remainingRequests } from "@/features/subscriptions/quota";
import { expireDueSubscriptions, getProviderSubscriptions, listActivePlans } from "@/features/subscriptions/service";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "اشتراک" };

const limit = (v: number | null | undefined) => (v === null || v === undefined ? "نامحدود" : toPersianDigits(v));
const left = (v: number) => (v === Infinity ? "نامحدود" : toPersianDigits(v));

export default async function ProviderSubscriptionPage() {
  const user = await requireRolePage("PROVIDER");
  await expireDueSubscriptions();
  const [{ all, current, upcoming }, plans, wallet] = await Promise.all([getProviderSubscriptions(user.id), listActivePlans(), getWalletOverview(user.id)]);

  return (
    <>
      <PageHeader
        title="اشتراک"
        description="برای دریافت درخواست و ارسال پیشنهاد به اشتراک فعال نیاز دارید."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/provider/wallet">
              <Wallet />
              کیف پول: {formatPrice(wallet.balance)}
            </Link>
          </Button>
        }
      />

      {current.length === 0 ? (
        <Alert variant="destructive">
          <AlertDescription>در حال حاضر اشتراک فعالی ندارید و درخواست جدیدی برای شما ارسال نمی‌شود.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {current.map((s) => {
            const plan = parsePlanSnapshot(s.planSnapshot);
            return (
              <Card key={s.id} className="border-primary/40">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {s.plan.name}
                    <Badge>فعال</Badge>
                  </CardTitle>
                  <CardDescription>
                    {s.startsAt ? formatDate(s.startsAt) : ""} تا {s.endsAt ? formatDate(s.endsAt) : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">درخواست‌های دریافتی</p>
                    <p className="font-semibold">
                      {toPersianDigits(s.requestsReceived)} از {limit(plan?.maxRequestsPerPeriod)} (باقی‌مانده: {left(remainingRequests(s))})
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">پیشنهادهای ارسالی</p>
                    <p className="font-semibold">
                      {toPersianDigits(s.offersSubmitted)} از {limit(plan?.maxOffersPerPeriod)} (باقی‌مانده: {left(remainingOffers(s))})
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {upcoming.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {toPersianDigits(upcoming.length)} اشتراک تمدیدی پس از پایان اشتراک فعلی آغاز می‌شود
          {upcoming[0].startsAt ? ` (از ${formatDate(upcoming[0].startsAt)})` : ""}.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">پلن‌های اشتراک</h2>
        <Alert>
          <FlaskConical />
          <AlertDescription>پرداخت‌ها شبیه‌سازی‌شده هستند و هیچ وجه واقعی دریافت نمی‌شود. خرید جدید پس از پایان اشتراک فعال فعلی آغاز می‌شود.</AlertDescription>
        </Alert>
        {plans.length === 0 ? (
          <EmptyState title="پلن فعالی تعریف نشده است" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
              return (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <p className="text-2xl font-extrabold">{formatPrice(plan.price)}</p>
                    <p className="text-sm text-muted-foreground">مدت: {toPersianDigits(plan.durationDays)} روز</p>
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex gap-2"><Check className="size-4 text-success" aria-hidden />سقف دریافت درخواست: {limit(plan.maxRequestsPerPeriod)}</li>
                      <li className="flex gap-2"><Check className="size-4 text-success" aria-hidden />سقف ارسال پیشنهاد: {limit(plan.maxOffersPerPeriod)}</li>
                      {features.map((f) => (
                        <li key={f} className="flex gap-2"><Check className="size-4 text-success" aria-hidden />{f}</li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <ActionButton
                      action={purchaseSubscriptionAction.bind(null, plan.id, "GATEWAY")}
                      confirm={{ title: `خرید پلن ${plan.name}`, description: `مبلغ ${formatPrice(plan.price)} از طریق درگاه شبیه‌سازی‌شده`, confirmLabel: "رفتن به درگاه" }}
                    >
                      <CreditCard />
                      پرداخت با درگاه
                    </ActionButton>
                    <ActionButton
                      action={purchaseSubscriptionAction.bind(null, plan.id, "WALLET")}
                      variant="outline"
                      confirm={{ title: `خرید پلن ${plan.name} با کیف پول`, description: `مبلغ ${formatPrice(plan.price)} از کیف پول شما کسر می‌شود (موجودی: ${formatPrice(wallet.balance)}).`, confirmLabel: "پرداخت" }}
                    >
                      <Wallet />
                      پرداخت از کیف پول
                    </ActionButton>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">سابقه اشتراک‌ها</h2>
        {all.length === 0 ? (
          <EmptyState title="هنوز اشتراکی نداشته‌اید" />
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">پلن</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">شروع</TableHead>
                  <TableHead className="text-start">پایان</TableHead>
                  <TableHead className="text-start">درخواست / پیشنهاد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {all.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.plan.name}</TableCell>
                    <TableCell>
                      <Badge variant={SUBSCRIPTION_STATUS_META[s.status].variant}>{SUBSCRIPTION_STATUS_META[s.status].label}</Badge>
                    </TableCell>
                    <TableCell>{s.startsAt ? formatDate(s.startsAt) : "—"}</TableCell>
                    <TableCell>{s.endsAt ? formatDate(s.endsAt) : "—"}</TableCell>
                    <TableCell>
                      {toPersianDigits(s.requestsReceived)} / {toPersianDigits(s.offersSubmitted)}
                    </TableCell>
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
