import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PAYMENT_GATEWAY_LABELS, PAYMENT_PURPOSE_LABELS, PAYMENT_STATUS_META, WALLET_REASON_LABELS } from "@/features/payments/rules";
import { cn, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

type PaymentRow = {
  id: string;
  code: number;
  amount: number;
  purpose: keyof typeof PAYMENT_PURPOSE_LABELS;
  status: keyof typeof PAYMENT_STATUS_META;
  gateway: keyof typeof PAYMENT_GATEWAY_LABELS;
  trackingCode: string | null;
  createdAt: Date;
  user?: { fullName: string; phone: string };
  failureReason?: string | null;
};

export function PaymentsTable({ payments, linkToGateway }: { payments: PaymentRow[]; linkToGateway?: boolean }) {
  if (payments.length === 0) return <EmptyState title="پرداختی ثبت نشده است" />;
  const showUser = payments.some((p) => p.user);
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">شماره</TableHead>
            {showUser ? <TableHead className="text-start">کاربر</TableHead> : null}
            <TableHead className="text-start">بابت</TableHead>
            <TableHead className="text-start">مبلغ</TableHead>
            <TableHead className="text-start">روش</TableHead>
            <TableHead className="text-start">وضعیت</TableHead>
            <TableHead className="text-start">کد پیگیری</TableHead>
            <TableHead className="text-start">تاریخ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                {linkToGateway ? (
                  <Link href={`/payment/${p.id}`} className="text-primary hover:underline">
                    {toPersianDigits(p.code)}
                  </Link>
                ) : (
                  toPersianDigits(p.code)
                )}
              </TableCell>
              {showUser ? (
                <TableCell>
                  {p.user?.fullName}
                  <span className="block text-xs text-muted-foreground ltr-nums">{p.user?.phone}</span>
                </TableCell>
              ) : null}
              <TableCell>{PAYMENT_PURPOSE_LABELS[p.purpose]}</TableCell>
              <TableCell>{formatPrice(p.amount)}</TableCell>
              <TableCell>
                {PAYMENT_GATEWAY_LABELS[p.gateway]}
                <Badge variant="outline" className="ms-1">شبیه‌سازی</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={PAYMENT_STATUS_META[p.status].variant}>{PAYMENT_STATUS_META[p.status].label}</Badge>
                {p.failureReason ? <span className="block text-xs text-muted-foreground">{p.failureReason}</span> : null}
              </TableCell>
              <TableCell className="ltr-nums font-mono text-xs">{p.trackingCode ?? "—"}</TableCell>
              <TableCell>{formatDateTime(p.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type TxRow = {
  id: string;
  type: "CREDIT" | "DEBIT";
  reason: keyof typeof WALLET_REASON_LABELS;
  amount: number;
  balanceAfter: number;
  description: string | null;
  createdAt: Date;
  owner?: string;
};

export function WalletTransactionsTable({ transactions }: { transactions: TxRow[] }) {
  if (transactions.length === 0) return <EmptyState title="تراکنشی ثبت نشده است" />;
  const showOwner = transactions.some((t) => t.owner);
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {showOwner ? <TableHead className="text-start">کاربر</TableHead> : null}
            <TableHead className="text-start">شرح</TableHead>
            <TableHead className="text-start">مبلغ</TableHead>
            <TableHead className="text-start">مانده</TableHead>
            <TableHead className="text-start">تاریخ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              {showOwner ? <TableCell>{t.owner}</TableCell> : null}
              <TableCell>
                {WALLET_REASON_LABELS[t.reason]}
                {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
              </TableCell>
              <TableCell className={cn("font-medium", t.type === "CREDIT" ? "text-success" : "text-destructive")}>
                {t.type === "CREDIT" ? "+" : "−"}
                {formatPrice(t.amount)}
              </TableCell>
              <TableCell>{formatPrice(t.balanceAfter)}</TableCell>
              <TableCell>{formatDateTime(t.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
