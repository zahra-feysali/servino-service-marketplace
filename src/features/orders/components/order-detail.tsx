import { CalendarClock, MapPin, Phone, Star, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTimeline } from "@/components/shared/status-timeline";
import type { AppRole } from "@/features/auth/rbac";
import { ORDER_STATUS_META } from "@/features/orders/labels";
import type { getOrderDetail } from "@/features/orders/service";
import { DURATION_UNIT_LABELS } from "@/features/requests/labels";
import { formatDate, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";
import { OrderActions } from "./order-actions";

type Order = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Order page body shared by customer and provider dashboards. */
export function OrderDetail({ order, viewerRole, reviewSlot }: { order: Order; viewerRole: AppRole; reviewSlot?: React.ReactNode }) {
  const meta = ORDER_STATUS_META[order.status];
  const providerParty = { title: "متخصص", name: order.provider.displayName, phone: order.provider.user.phone };
  const customerParty = { title: "مشتری", name: order.customer.fullName, phone: order.customer.phone };
  const parties = viewerRole === "ADMIN" ? [customerParty, providerParty] : [viewerRole === "CUSTOMER" ? providerParty : customerParty];
  // Admins always see contact data (support); parties see each other only while the order is not cancelled.
  const showContact = viewerRole === "ADMIN" || order.status !== "CANCELLED";

  return (
    <>
      <PageHeader
        title={`سفارش ${toPersianDigits(order.code)} — ${order.service.name}`}
        description={`ثبت‌شده در ${formatDateTime(order.createdAt)}`}
        actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">جزئیات سفارش</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">مبلغ توافق‌شده</dt>
                  <dd className="text-lg font-bold">{formatPrice(order.price)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">زمان تقریبی انجام</dt>
                  <dd className="font-medium">
                    {toPersianDigits(order.offer.estimatedDuration)} {DURATION_UNIT_LABELS[order.offer.estimatedDurationUnit]}
                  </dd>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">محل انجام کار</dt>
                    <dd className="font-medium">
                      {order.request.city.name} — {order.request.addressText}
                    </dd>
                  </div>
                </div>
                {order.request.preferredDate ? (
                  <div className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    <div>
                      <dt className="text-xs text-muted-foreground">تاریخ ترجیحی</dt>
                      <dd className="font-medium">{formatDate(order.request.preferredDate)}</dd>
                    </div>
                  </div>
                ) : null}
              </dl>
              <div>
                <p className="text-xs text-muted-foreground">توضیحات پیشنهاد متخصص</p>
                <p className="leading-7 whitespace-pre-line">{order.offer.description}</p>
                {order.offer.notes ? <p className="mt-1 text-muted-foreground">{order.offer.notes}</p> : null}
              </div>
              {order.cancelReason ? (
                <p className="rounded-lg bg-destructive/10 p-3 text-destructive">دلیل لغو: {order.cancelReason}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">اقدامات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <OrderActions orderId={order.id} status={order.status} role={viewerRole} />
              {order.status === "COMPLETED" || order.status === "CANCELLED" ? (
                <p className="text-sm text-muted-foreground">این سفارش بسته شده است.</p>
              ) : null}
              {reviewSlot}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {parties.map((counterpart) => (
          <Card key={counterpart.title}>
            <CardHeader>
              <CardTitle className="text-base">{counterpart.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <User className="size-4 text-muted-foreground" aria-hidden />
                {counterpart.name}
              </p>
              {showContact ? (
                <p className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  <a href={`tel:${counterpart.phone}`} className="ltr-nums text-primary hover:underline">
                    {counterpart.phone}
                  </a>
                </p>
              ) : null}
              {counterpart === providerParty && order.provider.ratingCount > 0 ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Star className="size-4 fill-warning text-warning" aria-hidden />
                  {order.provider.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} از ۵ (
                  {toPersianDigits(order.provider.ratingCount)} نظر)
                </p>
              ) : null}
            </CardContent>
          </Card>
          ))}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تاریخچه وضعیت</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline
                entries={order.history.map((h) => ({ id: h.id, label: ORDER_STATUS_META[h.toStatus].label, note: h.note, createdAt: h.createdAt }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
