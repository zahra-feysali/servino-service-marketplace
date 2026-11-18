import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, Clock, Star, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { cancelRequestAction, selectOfferAction } from "@/features/marketplace/actions";
import { offerHighlights, sortOffers, type OfferSort } from "@/features/offers/rules";
import { AnswersView, AttachmentList } from "@/features/requests/components/answers-view";
import { DURATION_UNIT_LABELS, OFFER_STATUS_META, REQUEST_STATUS_META, effectiveRequestStatus } from "@/features/requests/labels";
import { getCustomerRequestDetail } from "@/features/requests/queries";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { UserAvatar } from "@/components/shared/user-avatar";
import { avatarSrc } from "@/features/avatars/rules";
import { cn, formatDate, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "جزئیات درخواست" };

const SORTS: { value: OfferSort; label: string }[] = [
  { value: "price", label: "ارزان‌ترین" },
  { value: "duration", label: "سریع‌ترین" },
  { value: "rating", label: "بیشترین امتیاز" },
];

export default async function CustomerRequestDetailPage({ params, searchParams }: PageProps<"/dashboard/customer/requests/[id]">) {
  const user = await requireRolePage("CUSTOMER");
  const { id } = await params;
  const { sort } = await searchParams;
  if (!isUuid(id)) notFound();
  const request = await getCustomerRequestDetail(user.id, id);
  if (!request) notFound();

  const status = effectiveRequestStatus(request);
  const sortKey: OfferSort = SORTS.some((s) => s.value === sort) ? (sort as OfferSort) : "price";
  const comparable = request.offers.map((o) => ({ ...o, ratingAverage: o.provider.ratingAverage, ratingCount: o.provider.ratingCount }));
  const offers = sortOffers(comparable, sortKey);
  const pendingOffers = offers.filter((o) => o.status === "PENDING");
  const highlights = offerHighlights(pendingOffers);
  const canSelect = status === "OPEN";
  const generalAttachments = request.attachments.filter((a) => !a.fieldName);

  return (
    <>
      <PageHeader
        title={`درخواست ${toPersianDigits(request.code)} — ${request.service.name}`}
        description={`ثبت‌شده در ${formatDateTime(request.createdAt)}${request.expiresAt && status === "OPEN" ? ` · مهلت دریافت پیشنهاد تا ${formatDate(request.expiresAt)}` : ""}`}
        actions={
          <>
            <Badge variant={REQUEST_STATUS_META[status].variant}>{REQUEST_STATUS_META[status].label}</Badge>
            {request.order ? (
              <Button asChild size="sm">
                <Link href={`/dashboard/customer/orders/${request.order.id}`}>
                  مشاهده سفارش
                  <ArrowLeft />
                </Link>
              </Button>
            ) : null}
            {request.status === "OPEN" ? (
              <ActionButton
                action={cancelRequestAction.bind(null, request.id)}
                variant="outline"
                size="sm"
                confirm={{ title: "لغو درخواست؟", description: "پیشنهادهای در انتظار رد می‌شوند.", confirmLabel: "لغو درخواست", destructive: true }}
                note={{ label: "دلیل لغو", required: true }}
              >
                <XCircle />
                لغو درخواست
              </ActionButton>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">پیشنهادهای دریافتی ({toPersianDigits(request.offers.length)})</CardTitle>
            <CardDescription>پیشنهادها را مقایسه کنید و بهترین متخصص را انتخاب کنید.</CardDescription>
          </div>
          {offers.length > 1 ? (
            <nav className="flex gap-1" aria-label="مرتب‌سازی پیشنهادها">
              {SORTS.map((s) => (
                <Button key={s.value} asChild size="sm" variant={sortKey === s.value ? "secondary" : "ghost"}>
                  <Link href={`?sort=${s.value}`} scroll={false}>
                    {s.label}
                  </Link>
                </Button>
              ))}
            </nav>
          ) : null}
        </CardHeader>
        <CardContent>
          {offers.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="هنوز پیشنهادی نرسیده است"
              description={status === "OPEN" ? "متخصصان مرتبط از ثبت درخواست شما مطلع شده‌اند. به‌محض دریافت پیشنهاد، اعلان دریافت می‌کنید." : undefined}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {offers.map((o) => (
                <div
                  key={o.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4",
                    o.status === "ACCEPTED" && "border-primary ring-2 ring-primary/20",
                    (o.status === "REJECTED" || o.status === "WITHDRAWN") && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                    <UserAvatar name={o.provider.displayName} src={avatarSrc(o.provider.userId, o.provider.user.avatarUpdatedAt)} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold">{o.provider.displayName}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="size-3.5 fill-warning text-warning" aria-hidden />
                        {o.provider.ratingCount > 0
                          ? `${o.provider.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} (${toPersianDigits(o.provider.ratingCount)} نظر)`
                          : "بدون نظر"}
                        {" · "}
                        {toPersianDigits(o.provider.completedOrdersCount)} سفارش موفق · {toPersianDigits(o.provider.yearsOfExperience)} سال سابقه
                      </p>
                    </div>
                    </div>
                    <Badge variant={OFFER_STATUS_META[o.status].variant}>{OFFER_STATUS_META[o.status].label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {highlights.cheapest === o.id ? <Badge variant="secondary"><Wallet />ارزان‌ترین</Badge> : null}
                    {highlights.fastest === o.id ? <Badge variant="secondary"><Clock />سریع‌ترین</Badge> : null}
                    {highlights.bestRated === o.id ? <Badge variant="secondary"><Award />بهترین امتیاز</Badge> : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">قیمت</dt>
                      <dd className="text-lg font-bold">{formatPrice(o.price)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">زمان انجام</dt>
                      <dd className="font-medium">
                        {toPersianDigits(o.estimatedDuration)} {DURATION_UNIT_LABELS[o.estimatedDurationUnit]}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-sm leading-7 whitespace-pre-line text-muted-foreground">{o.description}</p>
                  {o.notes ? <p className="text-xs text-muted-foreground">یادداشت: {o.notes}</p> : null}
                  {canSelect && o.status === "PENDING" ? (
                    <ActionButton
                      action={selectOfferAction.bind(null, request.id, o.id)}
                      className="mt-auto"
                      redirectBase="/dashboard/customer/orders"
                      confirm={{
                        title: `انتخاب ${o.provider.displayName}؟`,
                        description: `با انتخاب این پیشنهاد (${formatPrice(o.price)})، سفارش ایجاد شده و سایر پیشنهادها رد می‌شوند. این عمل قابل بازگشت نیست.`,
                        confirmLabel: "انتخاب و ایجاد سفارش",
                      }}
                    >
                      انتخاب این متخصص
                    </ActionButton>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">اطلاعات درخواست</CardTitle>
            <CardDescription>
              {request.city.name} — {request.addressText}
              {request.preferredDate ? ` · تاریخ ترجیحی: ${formatDate(request.preferredDate)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AnswersView fields={request.fields} answers={request.answers} attachments={request.attachments} />
            {request.description ? (
              <div>
                <p className="text-xs text-muted-foreground">توضیحات تکمیلی</p>
                <p className="text-sm leading-7 whitespace-pre-line">{request.description}</p>
              </div>
            ) : null}
            {generalAttachments.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">پیوست‌ها</p>
                <AttachmentList attachments={generalAttachments} />
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تاریخچه وضعیت</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline
              entries={request.history.map((h) => ({ id: h.id, label: REQUEST_STATUS_META[h.toStatus].label, note: h.note, createdAt: h.createdAt }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
