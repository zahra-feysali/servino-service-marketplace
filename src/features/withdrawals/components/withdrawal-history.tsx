import { Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { cancelWithdrawalAction } from "@/features/withdrawals/actions";
import { WITHDRAWAL_STATUS_META, maskSheba, type WithdrawalStatusValue } from "@/features/withdrawals/rules";
import { formatDate, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatusValue }) {
  const meta = WITHDRAWAL_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

type Row = {
  id: string;
  code: number;
  amount: number;
  status: WithdrawalStatusValue;
  ibanSnapshot: string;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  paidAt: Date | null;
  payoutReference: string | null;
  cancelledAt: Date | null;
};

/** The provider's own withdrawal history (bank details masked; cancel only while PENDING). */
export function ProviderWithdrawalHistory({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Banknote} title="هنوز درخواست برداشتی ثبت نکرده‌اید" description="پس از ثبت درخواست، وضعیت آن را اینجا پیگیری کنید." />;
  }
  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>شماره</TableHead>
            <TableHead>تاریخ درخواست</TableHead>
            <TableHead>مبلغ</TableHead>
            <TableHead>شبا مقصد</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead>جزئیات</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{toPersianDigits(r.code)}</TableCell>
              <TableCell>{formatDateTime(r.createdAt)}</TableCell>
              <TableCell className="font-bold">{formatPrice(r.amount)}</TableCell>
              <TableCell dir="ltr" className="text-end font-mono text-xs">
                {maskSheba(r.ibanSnapshot)}
              </TableCell>
              <TableCell>
                <WithdrawalStatusBadge status={r.status} />
              </TableCell>
              <TableCell className="max-w-72 whitespace-normal text-xs leading-6 text-muted-foreground">
                {r.status === "PAID" && r.paidAt ? (
                  <>
                    پرداخت در {formatDate(r.paidAt)}
                    {r.payoutReference ? (
                      <>
                        {" "}— کد پیگیری <span dir="ltr" className="font-mono">{r.payoutReference}</span>
                      </>
                    ) : null}
                  </>
                ) : r.status === "REJECTED" ? (
                  <>دلیل رد: {r.rejectionReason}</>
                ) : r.status === "APPROVED" && r.approvedAt ? (
                  <>تأیید در {formatDate(r.approvedAt)} — در انتظار واریز دستی</>
                ) : r.status === "CANCELLED" && r.cancelledAt ? (
                  <>لغو در {formatDate(r.cancelledAt)}</>
                ) : (
                  <>در صف بررسی مدیریت</>
                )}
              </TableCell>
              <TableCell>
                {r.status === "PENDING" ? (
                  <ActionButton
                    action={cancelWithdrawalAction.bind(null, r.id)}
                    variant="outline"
                    size="sm"
                    confirm={{
                      title: `لغو درخواست برداشت ${toPersianDigits(r.code)}؟`,
                      description: `مبلغ ${formatPrice(r.amount)} دوباره به موجودی قابل برداشت شما برمی‌گردد.`,
                      confirmLabel: "لغو درخواست",
                      destructive: true,
                    }}
                  >
                    لغو
                  </ActionButton>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
