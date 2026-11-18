import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CreditCard, FlaskConical, Sparkles, Wallet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { purchaseFeaturedPlanAction } from "@/features/featured/purchase-actions";
import { FEATURED_STATE_META } from "@/features/featured/purchase-rules";
import { listActiveFeaturedPlans, listProviderFeatured } from "@/features/featured/purchase-service";
import { PLACEMENT_LABELS } from "@/features/featured/rules";
import { getWalletBalance } from "@/features/payments/service";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "نمایش ویژه" };

export default async function ProviderFeaturedPage() {
  const user = await requireRolePage("PROVIDER");
  const [{ approved, entries }, plans, balance] = await Promise.all([listProviderFeatured(user.id), listActiveFeaturedPlans(), getWalletBalance(user.id)]);
  const running = entries.filter((e) => e.state === "ACTIVE" || e.state === "SCHEDULED");

  return (
    <>
      <PageHeader
        icon={Sparkles}
        title="نمایش ویژه"
        description="با خرید پلن ویژه، پروفایل شما در جایگاه انتخابی بالاتر از سایر متخصصان نمایش داده می‌شود."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/provider/wallet">
              <Wallet />
              کیف پول: {formatPrice(balance)}
            </Link>
          </Button>
        }
      />

      {running.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {running.map((e) => (
            <Card key={e.id} className={e.state === "ACTIVE" ? "border-highlight/60 bg-highlight/5" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-500" aria-hidden />
                    {e.plan?.name ?? "جایگاه ویژه (اهدایی مدیر)"}
                  </span>
                  <Badge variant={FEATURED_STATE_META[e.state].variant}>{FEATURED_STATE_META[e.state].label}</Badge>
                </CardTitle>
                <CardDescription>{PLACEMENT_LABELS[e.placement]}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-sm">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                از {formatDate(e.startsAt)} تا {formatDate(e.endsAt)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Alert>
          <Sparkles />
          <AlertDescription>در حال حاضر نمایش ویژه فعالی ندارید.</AlertDescription>
        </Alert>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-bold">پلن‌های ویژه</h2>
        <Alert>
          <FlaskConical />
          <AlertDescription>
            پرداخت‌ها شبیه‌سازی‌شده هستند و وجه واقعی دریافت نمی‌شود. خرید مجدد همان جایگاه، پس از پایان دوره فعلی شروع می‌شود (تمدید).
          </AlertDescription>
        </Alert>
        {!approved ? (
          <Alert variant="destructive">
            <AlertDescription>خرید پلن ویژه پس از تأیید پروفایل حرفه‌ای شما امکان‌پذیر است.</AlertDescription>
          </Alert>
        ) : null}
        {plans.length === 0 ? (
          <EmptyState icon={Sparkles} title="پلن ویژه‌ای تعریف نشده است" description="مدیر سایت هنوز پلنی برای فروش تعریف نکرده است." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description ?? `نمایش ویژه در ${PLACEMENT_LABELS[plan.placement]}`}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-2">
                  <p className="text-2xl font-extrabold">{formatPrice(plan.price)}</p>
                  <p className="text-sm text-muted-foreground">
                    جایگاه: {PLACEMENT_LABELS[plan.placement]} · مدت: {toPersianDigits(plan.durationDays)} روز
                  </p>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  {approved ? (
                    <>
                      <ActionButton
                        action={purchaseFeaturedPlanAction.bind(null, plan.id, "GATEWAY")}
                        confirm={{ title: `خرید «${plan.name}»`, description: `مبلغ ${formatPrice(plan.price)} از طریق درگاه شبیه‌سازی‌شده`, confirmLabel: "رفتن به درگاه" }}
                      >
                        <CreditCard />
                        پرداخت با درگاه
                      </ActionButton>
                      <ActionButton
                        action={purchaseFeaturedPlanAction.bind(null, plan.id, "WALLET")}
                        variant="outline"
                        confirm={{
                          title: `خرید «${plan.name}» با کیف پول`,
                          description: `مبلغ ${formatPrice(plan.price)} از کیف پول کسر و پلن بلافاصله فعال می‌شود (موجودی: ${formatPrice(balance)}).`,
                          confirmLabel: "پرداخت و فعال‌سازی",
                        }}
                      >
                        <Wallet />
                        پرداخت از کیف پول
                      </ActionButton>
                    </>
                  ) : null}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">سابقه نمایش ویژه</h2>
        {entries.length === 0 ? (
          <EmptyState icon={Sparkles} title="هنوز سابقه‌ای ندارید" />
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">پلن</TableHead>
                  <TableHead className="text-start">جایگاه</TableHead>
                  <TableHead className="text-start">بازه</TableHead>
                  <TableHead className="text-start">مبلغ</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.plan?.name ?? "اهدایی مدیر"}</TableCell>
                    <TableCell>{PLACEMENT_LABELS[e.placement]}</TableCell>
                    <TableCell className="text-xs">{e.paidAt || e.source === "ADMIN" ? `${formatDate(e.startsAt)} تا ${formatDate(e.endsAt)}` : "—"}</TableCell>
                    <TableCell>{e.price !== null ? formatPrice(e.price) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={FEATURED_STATE_META[e.state].variant}>{FEATURED_STATE_META[e.state].label}</Badge>
                        {e.state === "PENDING_PAYMENT" && e.payment?.status === "PENDING" ? (
                          <Button asChild size="sm" variant="link" className="h-auto p-0">
                            <Link href={`/payment/${e.payment.id}`}>ادامه پرداخت</Link>
                          </Button>
                        ) : null}
                      </div>
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
