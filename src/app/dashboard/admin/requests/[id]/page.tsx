import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flag, FlagOff, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { adminCancelRequestAction, adminSetRequestFlagAction } from "@/features/admin/actions";
import { adminGetRequest } from "@/features/admin/queries";
import { AnswersView, AttachmentList } from "@/features/requests/components/answers-view";
import { DURATION_UNIT_LABELS, OFFER_STATUS_META, REQUEST_STATUS_META, effectiveRequestStatus } from "@/features/requests/labels";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "بررسی درخواست" };

export default async function AdminRequestPage({ params }: PageProps<"/dashboard/admin/requests/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await adminGetRequest(id);
  if (!r) notFound();
  const status = effectiveRequestStatus(r);

  return (
    <>
      <PageHeader
        title={`درخواست ${toPersianDigits(r.code)} — ${r.service.name}`}
        description={`${r.customer.fullName} (${r.customer.phone}) · ${r.city.name} · ${formatDateTime(r.createdAt)} · نسخه فرم ${toPersianDigits(r.formVersion)}`}
        actions={
          <>
            <Badge variant={REQUEST_STATUS_META[status].variant}>{REQUEST_STATUS_META[status].label}</Badge>
            {r.order ? (
              <Button asChild size="sm">
                <Link href={`/dashboard/admin/orders/${r.order.id}`}>سفارش {toPersianDigits(r.order.code)}</Link>
              </Button>
            ) : null}
            {r.isFlagged ? (
              <ActionButton action={adminSetRequestFlagAction.bind(null, r.id, false)} size="sm" variant="outline">
                <FlagOff />
                رفع علامت مشکل‌دار
              </ActionButton>
            ) : (
              <ActionButton
                action={adminSetRequestFlagAction.bind(null, r.id, true)}
                size="sm"
                variant="outline"
                note={{ label: "دلیل", required: true }}
                confirm={{ title: "علامت‌گذاری به‌عنوان مشکل‌دار" }}
              >
                <Flag />
                علامت مشکل‌دار
              </ActionButton>
            )}
            {r.status === "OPEN" ? (
              <ActionButton
                action={adminCancelRequestAction.bind(null, r.id)}
                size="sm"
                variant="destructive"
                confirm={{ title: "لغو درخواست؟", description: "پیشنهادهای در انتظار رد شده و طرفین مطلع می‌شوند.", confirmLabel: "لغو", destructive: true }}
                note={{ label: "دلیل (برای مشتری ارسال می‌شود)", required: true }}
              >
                <XCircle />
                لغو درخواست
              </ActionButton>
            ) : null}
          </>
        }
      />

      {r.isFlagged ? (
        <Alert variant="destructive">
          <Flag />
          <AlertTitle>این درخواست گزارش شده است</AlertTitle>
          <AlertDescription>{r.flagReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">پاسخ‌های فرم</CardTitle>
            <CardDescription>
              {r.addressText}
              {r.preferredDate ? ` · تاریخ ترجیحی ${formatDate(r.preferredDate)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnswersView fields={r.fields} answers={r.answers} attachments={r.attachments} />
            {r.description ? <p className="text-sm leading-7 whitespace-pre-line">{r.description}</p> : null}
            {r.attachments.some((a) => !a.fieldName) ? <AttachmentList attachments={r.attachments.filter((a) => !a.fieldName)} /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تاریخچه</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline entries={r.history.map((h) => ({ id: h.id, label: REQUEST_STATUS_META[h.toStatus].label, note: h.note, createdAt: h.createdAt }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">متخصصان مطلع‌شده ({toPersianDigits(r.matches.length)}) و پیشنهادها ({toPersianDigits(r.offers.length)})</CardTitle>
          <CardDescription>{r.matches.map((m) => `${m.provider.displayName}${m.viewedAt ? " ✓" : ""}`).join("، ") || "هیچ متخصصی مطابق نبود."}</CardDescription>
        </CardHeader>
        <CardContent>
          {r.offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">پیشنهادی ثبت نشده است.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">متخصص</TableHead>
                  <TableHead className="text-start">قیمت</TableHead>
                  <TableHead className="text-start">زمان</TableHead>
                  <TableHead className="text-start">وضعیت</TableHead>
                  <TableHead className="text-start">تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.offers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/dashboard/admin/providers/${o.provider.id}`} className="text-primary hover:underline">
                        {o.provider.displayName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatPrice(o.price)}</TableCell>
                    <TableCell>
                      {toPersianDigits(o.estimatedDuration)} {DURATION_UNIT_LABELS[o.estimatedDurationUnit]}
                    </TableCell>
                    <TableCell>
                      <Badge variant={OFFER_STATUS_META[o.status].variant}>{OFFER_STATUS_META[o.status].label}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
