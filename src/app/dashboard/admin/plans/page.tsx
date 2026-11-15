import type { Metadata } from "next";
import { CalendarPlus, Pencil, Plus, Power, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { ServerForm, SubmitButton } from "@/components/shared/server-form";
import {
  adminCancelSubscriptionAction,
  adminDeletePlanAction,
  adminExpireSubscriptionsAction,
  adminExtendSubscriptionAction,
  adminSetPlanActiveAction,
} from "@/features/admin/actions";
import { PlanDialog } from "@/features/admin/components/plan-dialog";
import { SUBSCRIPTION_STATUS_META } from "@/features/subscriptions/lifecycle";
import { adminListPlans } from "@/features/subscriptions/plan-service";
import { adminListSubscriptions } from "@/features/subscriptions/service";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "پلن‌ها و اشتراک‌ها" };
const STATUSES = ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED"] as const;
const limit = (v: number | null) => (v === null ? "نامحدود" : toPersianDigits(v));

export default async function AdminPlansPage({ searchParams }: PageProps<"/dashboard/admin/plans">) {
  await requireRolePage("ADMIN");
  const { status: raw } = await searchParams;
  const status = pickParam(raw, STATUSES);
  const [plans, subs] = await Promise.all([adminListPlans(), adminListSubscriptions(status)]);

  return (
    <>
      <PageHeader
        title="پلن‌ها و اشتراک‌ها"
        description="تعریف پلن‌های اشتراک متخصصان و مدیریت تمدید و انقضا"
        actions={
          <PlanDialog
            trigger={
              <Button>
                <Plus />
                پلن جدید
              </Button>
            }
          />
        }
      />

      {plans.length === 0 ? (
        <EmptyState title="پلنی تعریف نشده است" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const features = Array.isArray(p.features) ? (p.features as string[]) : [];
            return (
              <Card key={p.id} className={p.isActive ? "" : "opacity-70"}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {p.name}
                    <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "فعال" : "غیرفعال"}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {formatPrice(p.price)} · {toPersianDigits(p.durationDays)} روز · {toPersianDigits(p._count.subscriptions)} اشتراک
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    درخواست: {limit(p.maxRequestsPerPeriod)} · پیشنهاد: {limit(p.maxOffersPerPeriod)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <PlanDialog
                      plan={{ ...p, features }}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Pencil />
                          ویرایش
                        </Button>
                      }
                    />
                    <ActionButton action={adminSetPlanActiveAction.bind(null, p.id, !p.isActive)} size="sm" variant="outline">
                      <Power />
                      {p.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    </ActionButton>
                    <ActionButton
                      action={adminDeletePlanAction.bind(null, p.id)}
                      size="sm"
                      variant="ghost"
                      confirm={{ title: `حذف پلن ${p.name}؟`, description: "فقط پلن بدون اشتراک قابل حذف است.", confirmLabel: "حذف", destructive: true }}
                    >
                      <Trash2 />
                      حذف
                    </ActionButton>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">اشتراک‌های کاربران</h2>
          <ActionButton action={adminExpireSubscriptionsAction} size="sm" variant="outline">
            <RefreshCw />
            بررسی و اعمال انقضا
          </ActionButton>
        </div>
        <FilterLinks
          basePath="/dashboard/admin/plans"
          param="status"
          current={status}
          options={[{ value: "", label: "همه" }, ...STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_STATUS_META[s].label }))]}
        />
        {subs.length === 0 ? (
          <EmptyState title="اشتراکی یافت نشد" />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">متخصص</TableHead>
                  <TableHead className="text-start">پلن</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">بازه</TableHead>
                  <TableHead className="text-start">مصرف (درخواست/پیشنهاد)</TableHead>
                  <TableHead className="text-start">اقدامات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {s.user.fullName}
                      <span className="block text-xs text-muted-foreground ltr-nums">{s.user.phone}</span>
                    </TableCell>
                    <TableCell>{s.plan.name}</TableCell>
                    <TableCell>
                      <Badge variant={SUBSCRIPTION_STATUS_META[s.status].variant}>{SUBSCRIPTION_STATUS_META[s.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.startsAt ? formatDate(s.startsAt) : "—"} تا {s.endsAt ? formatDate(s.endsAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {toPersianDigits(s.requestsReceived)} / {toPersianDigits(s.offersSubmitted)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {s.status === "ACTIVE" || s.status === "EXPIRED" ? (
                          <ServerForm action={adminExtendSubscriptionAction.bind(null, s.id)} className="flex items-center gap-1">
                            <Input name="days" type="number" min={1} max={365} defaultValue={30} dir="ltr" className="h-7 w-16" aria-label="روز تمدید" />
                            <SubmitButton size="sm" variant="outline">
                              <CalendarPlus />
                              تمدید
                            </SubmitButton>
                          </ServerForm>
                        ) : null}
                        {s.status === "ACTIVE" || s.status === "PENDING" ? (
                          <ActionButton
                            action={adminCancelSubscriptionAction.bind(null, s.id)}
                            size="sm"
                            variant="ghost"
                            confirm={{ title: "لغو اشتراک؟", confirmLabel: "لغو", destructive: true }}
                            note={{ label: "دلیل (برای متخصص ارسال می‌شود)", required: true }}
                          >
                            <XCircle />
                            لغو
                          </ActionButton>
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
