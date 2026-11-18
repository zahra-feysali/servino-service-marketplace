import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flag, Lock } from "lucide-react";
import { reportRequestAction } from "@/features/providers/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { withdrawOfferAction } from "@/features/marketplace/actions";
import { OfferForm } from "@/features/offers/components/offer-form";
import { OpenChatButton } from "@/features/chat/components/open-chat-button";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { AnswersView, AttachmentList } from "@/features/requests/components/answers-view";
import { DURATION_UNIT_LABELS, OFFER_STATUS_META, REQUEST_STATUS_META, effectiveRequestStatus } from "@/features/requests/labels";
import { getProviderRequestDetail, markMatchViewed } from "@/features/requests/queries";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "جزئیات درخواست" };

export default async function ProviderRequestDetailPage({ params }: PageProps<"/dashboard/provider/requests/[id]">) {
  const user = await requireRolePage("PROVIDER");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const profile = await getProviderProfileByUserId(user.id);
  const request = await getProviderRequestDetail(profile.id, id);
  if (!request) notFound();
  await markMatchViewed(profile.id, id);

  const status = effectiveRequestStatus(request);
  const offer = request.myOffer;
  const generalAttachments = request.attachments.filter((a) => !a.fieldName);

  return (
    <>
      <PageHeader
        title={`درخواست ${toPersianDigits(request.code)} — ${request.service.name}`}
        description={`${request.city.name} · ثبت در ${formatDateTime(request.createdAt)} · ${toPersianDigits(request.offerCount)} پیشنهاد`}
        actions={
          <>
            <Badge variant={REQUEST_STATUS_META[status].variant}>{REQUEST_STATUS_META[status].label}</Badge>
            <ActionButton
              action={reportRequestAction.bind(null, request.id)}
              size="sm"
              variant="ghost"
              confirm={{ title: "گزارش درخواست مشکل‌دار", description: "این درخواست برای بررسی به مدیر ارسال می‌شود.", confirmLabel: "ارسال گزارش" }}
              note={{ label: "دلیل گزارش", required: true, placeholder: "مثلاً: اطلاعات نادرست یا درخواست غیرمجاز" }}
            >
              <Flag />
              گزارش
            </ActionButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">جزئیات درخواست</CardTitle>
            <CardDescription>
              {request.preferredDate ? `تاریخ ترجیحی: ${formatDate(request.preferredDate)}` : "تاریخ ترجیحی مشخص نشده است."}
              {request.expiresAt && status === "OPEN" ? ` · مهلت ارسال پیشنهاد: ${formatDate(request.expiresAt)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AnswersView fields={request.fields} answers={request.answers} attachments={request.attachments} />
            {request.description ? (
              <div>
                <p className="text-xs text-muted-foreground">توضیحات مشتری</p>
                <p className="text-sm leading-7 whitespace-pre-line">{request.description}</p>
              </div>
            ) : null}
            {generalAttachments.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">پیوست‌ها</p>
                <AttachmentList attachments={generalAttachments} />
              </div>
            ) : null}
            <Alert>
              <Lock />
              <AlertDescription>نشانی دقیق و شماره تماس مشتری پس از انتخاب شدن پیشنهاد شما نمایش داده می‌شود.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{offer ? "پیشنهاد شما" : "ارسال پیشنهاد"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {offer ? (
              <>
                <Badge variant={OFFER_STATUS_META[offer.status].variant}>{OFFER_STATUS_META[offer.status].label}</Badge>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">قیمت</dt>
                    <dd className="text-lg font-bold">{formatPrice(offer.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">زمان انجام</dt>
                    <dd className="font-medium">
                      {toPersianDigits(offer.estimatedDuration)} {DURATION_UNIT_LABELS[offer.estimatedDurationUnit]}
                    </dd>
                  </div>
                </dl>
                <p className="text-sm leading-7 whitespace-pre-line text-muted-foreground">{offer.description}</p>
                {offer.order ? (
                  <Button asChild>
                    <Link href={`/dashboard/provider/orders/${offer.order.id}`}>
                      مشاهده سفارش
                      <ArrowLeft />
                    </Link>
                  </Button>
                ) : null}
                <OpenChatButton requestId={request.id} label="گفتگو با مشتری" />
                {offer.status === "PENDING" && request.status === "OPEN" ? (
                  <ActionButton
                    action={withdrawOfferAction.bind(null, offer.id)}
                    variant="outline"
                    confirm={{ title: "انصراف از پیشنهاد؟", description: "سهمیه مصرف‌شده بازگردانده نمی‌شود.", confirmLabel: "انصراف", destructive: true }}
                  >
                    انصراف از پیشنهاد
                  </ActionButton>
                ) : null}
              </>
            ) : status !== "OPEN" ? (
              <p className="text-sm text-muted-foreground">این درخواست دیگر پیشنهاد جدید نمی‌پذیرد.</p>
            ) : profile.verificationStatus !== "APPROVED" ? (
              <p className="text-sm text-muted-foreground">برای ارسال پیشنهاد، حساب حرفه‌ای شما باید تأیید شده باشد.</p>
            ) : (
              <OfferForm requestId={request.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
