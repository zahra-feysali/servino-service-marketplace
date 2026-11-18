import Link from "next/link";
import { CreditCard, Info, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import type { AppRole } from "@/features/auth/rbac";
import { payOrderWithWalletAction, startOrderGatewayPaymentAction } from "@/features/finance/actions";
import { ORDER_PAYMENT_STATUS_META, SETTLEMENT_STATUS_META, bpsToPercent } from "@/features/finance/rules";
import { formatDateTime, formatPrice } from "@/lib/utils";

type Settlement = {
  status: "HELD" | "RELEASED" | "REFUNDED";
  grossAmount: number;
  commissionRateBps: number;
  commissionAmount: number;
  providerAmount: number;
  heldAt: Date;
  releasedAt: Date | null;
  refundedAt: Date | null;
};

type Props = {
  orderId: string;
  orderStatus: string;
  price: number;
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
  paidAt: Date | null;
  settlement: Settlement | null;
  viewerRole: AppRole;
  walletBalance?: number;
};

const PAYABLE = ["PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "IN_PROGRESS", "PROVIDER_COMPLETED"];

/** Order payment & escrow card (customer: pay; provider/admin: commission breakdown). */
export function OrderPaymentCard(p: Props) {
  const meta = ORDER_PAYMENT_STATUS_META[p.paymentStatus];
  const canPay = p.viewerRole === "CUSTOMER" && p.paymentStatus === "UNPAID" && PAYABLE.includes(p.orderStatus);
  const enough = (p.walletBalance ?? 0) >= p.price;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            پرداخت امن سفارش
          </CardTitle>
          <CardDescription>مبلغ سفارش تا تأیید تکمیل کار نزد سایت نگهداری می‌شود.</CardDescription>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canPay ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/50 p-3">
              <span className="text-muted-foreground">مبلغ قابل پرداخت</span>
              <span className="text-lg font-extrabold">{formatPrice(p.price)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                action={payOrderWithWalletAction.bind(null, p.orderId)}
                className={enough ? "" : "pointer-events-none opacity-50"}
                confirm={{
                  title: "پرداخت از کیف پول؟",
                  description: `مبلغ ${formatPrice(p.price)} از کیف پول شما کسر می‌شود (موجودی: ${formatPrice(p.walletBalance ?? 0)}).`,
                  confirmLabel: "پرداخت",
                }}
              >
                <Wallet />
                پرداخت از کیف پول
              </ActionButton>
              <ActionButton action={startOrderGatewayPaymentAction.bind(null, p.orderId)} variant="outline">
                <CreditCard />
                پرداخت با درگاه
              </ActionButton>
            </div>
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              موجودی کیف پول: {formatPrice(p.walletBalance ?? 0)}
              {!enough ? (
                <>
                  {" "}— موجودی کافی نیست.
                  <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                    <Link href="/dashboard/customer/wallet">شارژ کیف پول</Link>
                  </Button>
                </>
              ) : null}
            </p>
          </>
        ) : null}

        {p.viewerRole === "PROVIDER" && p.paymentStatus === "UNPAID" && PAYABLE.includes(p.orderStatus) ? (
          <p className="flex items-start gap-2 rounded-xl bg-accent/60 p-3 text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            مشتری هنوز هزینه را پرداخت نکرده است. شروع کار پس از پرداخت مشتری امکان‌پذیر است.
          </p>
        ) : null}

        {p.paidAt ? <p className="text-muted-foreground">زمان پرداخت: {formatDateTime(p.paidAt)}</p> : null}

        {p.settlement && p.viewerRole !== "CUSTOMER" ? (
          <dl className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">مبلغ پرداختی مشتری</dt>
              <dd className="font-bold">{formatPrice(p.settlement.grossAmount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">کمیسیون سایت ({bpsToPercent(p.settlement.commissionRateBps).toLocaleString("fa-IR")}٪)</dt>
              <dd className="font-bold">{formatPrice(p.settlement.commissionAmount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">سهم متخصص</dt>
              <dd className="font-bold text-success">{formatPrice(p.settlement.providerAmount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">وضعیت تسویه</dt>
              <dd>
                <Badge variant={SETTLEMENT_STATUS_META[p.settlement.status].variant}>{SETTLEMENT_STATUS_META[p.settlement.status].label}</Badge>
              </dd>
            </div>
            {p.settlement.releasedAt ? <p className="text-xs text-muted-foreground sm:col-span-2">آزادسازی: {formatDateTime(p.settlement.releasedAt)}</p> : null}
            {p.settlement.refundedAt ? <p className="text-xs text-muted-foreground sm:col-span-2">بازپرداخت: {formatDateTime(p.settlement.refundedAt)}</p> : null}
          </dl>
        ) : null}

        {p.paymentStatus === "REFUNDED" && p.viewerRole === "CUSTOMER" ? (
          <p className="rounded-xl bg-success/10 p-3 text-success">مبلغ این سفارش به کیف پول شما بازگشت داده شد.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
