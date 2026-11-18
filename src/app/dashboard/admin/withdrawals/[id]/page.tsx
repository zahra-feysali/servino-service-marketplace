import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Banknote, Landmark, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusTimeline } from "@/components/shared/status-timeline";
import { approveWithdrawalAction, markWithdrawalPaidAction, rejectWithdrawalAction } from "@/features/withdrawals/actions";
import { MarkPaidDialog } from "@/features/withdrawals/components/mark-paid-dialog";
import { WithdrawalStatusBadge } from "@/features/withdrawals/components/withdrawal-history";
import { adminGetWithdrawal } from "@/features/withdrawals/queries";
import { WITHDRAWAL_EVENT_LABELS, bankNameFromSheba, canApplyWithdrawalAction, formatSheba } from "@/features/withdrawals/rules";
import { requireRolePage } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "بررسی درخواست برداشت" };

const VERIFICATION_LABELS: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING: "در انتظار تأیید",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  SUSPENDED: "معلق",
};

export default async function AdminWithdrawalDetailPage({ params }: PageProps<"/dashboard/admin/withdrawals/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const w = await adminGetWithdrawal(id);
  if (!w) notFound();

  const bank = bankNameFromSheba(w.ibanSnapshot);
  const accountChanged = !!w.user.bankAccount && w.user.bankAccount.iban !== w.ibanSnapshot;
  const rows: [string, React.ReactNode][] = [
    ["مبلغ درخواستی", <strong key="a">{formatPrice(w.amount)}</strong>],
    ["وضعیت", <WithdrawalStatusBadge key="s" status={w.status} />],
    ["تاریخ درخواست", formatDateTime(w.createdAt)],
    ["صاحب حساب (هنگام درخواست)", w.holderNameSnapshot],
    [
      "شبا مقصد (هنگام درخواست)",
      <span key="i" dir="ltr" className="font-mono">
        {formatSheba(w.ibanSnapshot)}
      </span>,
    ],
    ["بانک", bank ?? "نامشخص"],
  ];
  if (w.approvedAt) rows.push(["تأیید", `${formatDateTime(w.approvedAt)} — ${w.reviewedBy?.fullName ?? ""}`]);
  if (w.rejectedAt) rows.push(["رد", `${formatDateTime(w.rejectedAt)} — ${w.reviewedBy?.fullName ?? ""}: ${w.rejectionReason ?? ""}`]);
  if (w.paidAt) {
    rows.push(["ثبت پرداخت", `${formatDateTime(w.paidAt)} — ${w.paidBy?.fullName ?? ""}`]);
    rows.push([
      "کد پیگیری انتقال",
      <span key="r" dir="ltr" className="font-mono">
        {w.payoutReference}
      </span>,
    ]);
    if (w.adminNote) rows.push(["یادداشت مدیر", w.adminNote]);
    if (w.walletTransaction) rows.push(["کسر از کیف پول", `${formatPrice(w.walletTransaction.amount)} — موجودی پس از کسر: ${formatPrice(w.walletTransaction.balanceAfter)}`]);
  }
  if (w.cancelledAt) rows.push(["لغو توسط متخصص", formatDateTime(w.cancelledAt)]);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/dashboard/admin/withdrawals">
          <ArrowRight />
          بازگشت به فهرست
        </Link>
      </Button>
      <PageHeader icon={Banknote} title={`درخواست برداشت ${toPersianDigits(w.code)}`} description="بانک به سایت متصل نیست؛ انتقال وجه را خودتان انجام دهید و سپس ثبت کنید." />

      {accountChanged ? (
        <Alert>
          <Landmark />
          <AlertDescription>متخصص پس از ثبت این درخواست حساب بانکی خود را تغییر داده است. واریز باید به شبای ثبت‌شده در همین درخواست انجام شود.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>جزئیات درخواست</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>

            {canApplyWithdrawalAction(w.status, "APPROVE") || canApplyWithdrawalAction(w.status, "PAY") || canApplyWithdrawalAction(w.status, "REJECT") ? (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {canApplyWithdrawalAction(w.status, "APPROVE") ? (
                  <ActionButton
                    action={approveWithdrawalAction.bind(null, w.id)}
                    confirm={{
                      title: "تأیید درخواست برداشت؟",
                      description: `با تأیید، ${formatPrice(w.amount)} همچنان رزرو می‌ماند تا انتقال بانکی را انجام دهید و پرداخت را ثبت کنید. هیچ پولی خودکار منتقل نمی‌شود.`,
                      confirmLabel: "تأیید درخواست",
                    }}
                  >
                    تأیید درخواست
                  </ActionButton>
                ) : null}
                {canApplyWithdrawalAction(w.status, "PAY") ? (
                  <MarkPaidDialog action={markWithdrawalPaidAction.bind(null, w.id)} amountLabel={formatPrice(w.amount)} destination={formatSheba(w.ibanSnapshot)} />
                ) : null}
                {canApplyWithdrawalAction(w.status, "REJECT") ? (
                  <ActionButton
                    action={rejectWithdrawalAction.bind(null, w.id)}
                    variant="outline"
                    confirm={{
                      title: "رد درخواست برداشت؟",
                      description: `مبلغ رزروشده (${formatPrice(w.amount)}) به موجودی قابل برداشت متخصص برمی‌گردد. دلیل رد برای متخصص نمایش داده می‌شود.`,
                      confirmLabel: "رد درخواست",
                      destructive: true,
                    }}
                    note={{ label: "دلیل رد", required: true, placeholder: "مثلاً: نام صاحب حساب با نام متخصص یکسان نیست." }}
                  >
                    رد درخواست
                  </ActionButton>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5 text-primary" aria-hidden />
                متخصص
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{w.user.providerProfile?.displayName ?? w.user.fullName}</p>
              <p className="text-muted-foreground">{w.user.fullName}</p>
              <p dir="ltr" className="text-end text-muted-foreground">
                {w.user.phone}
              </p>
              <p>
                وضعیت حساب: {w.user.status === "ACTIVE" ? "فعال" : <span className="text-destructive">غیرفعال / مسدود</span>} — تأیید:{" "}
                {VERIFICATION_LABELS[w.user.providerProfile?.verificationStatus ?? "DRAFT"] ?? "—"}
              </p>
              {w.user.providerProfile ? (
                <Link href={`/dashboard/admin/providers/${w.user.providerProfile.id}`} className="text-primary hover:underline">
                  پرونده متخصص
                </Link>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>کیف پول متخصص</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
                <dt className="text-muted-foreground">موجودی کل</dt>
                <dd>{formatPrice(w.balances.balance)}</dd>
                <dt className="text-muted-foreground">رزرو درخواست‌های باز</dt>
                <dd>{formatPrice(w.balances.reserved)}</dd>
                <dt className="text-muted-foreground">قابل برداشت</dt>
                <dd>{formatPrice(w.balances.available)}</dd>
                <dt className="text-muted-foreground">مجموع واریزشده</dt>
                <dd>{formatPrice(w.balances.paidTotal)}</dd>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>سابقه عملیات</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline
                entries={w.events.map((e) => ({
                  id: e.id,
                  label: `${WITHDRAWAL_EVENT_LABELS[e.type]} — ${e.actor.fullName}`,
                  note: e.note,
                  createdAt: e.createdAt,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
