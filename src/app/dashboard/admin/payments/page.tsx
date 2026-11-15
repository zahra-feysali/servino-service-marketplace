import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentsTable, WalletTransactionsTable } from "@/features/payments/components/payment-tables";
import { PAYMENT_STATUS_META } from "@/features/payments/rules";
import { adminListPayments, adminListWalletTransactions } from "@/features/payments/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "پرداخت‌ها و تراکنش‌ها" };
const STATUSES = ["PENDING", "SUCCEEDED", "FAILED"] as const;

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/dashboard/admin/payments">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const view = sp.view === "wallet" ? "wallet" : "payments";
  const status = pickParam(sp.status, STATUSES);
  const base = "/dashboard/admin/payments";

  return (
    <>
      <PageHeader title="پرداخت‌ها و تراکنش‌ها" description="مشاهده و بررسی وضعیت پرداخت‌ها و سابقه تراکنش‌های کیف پول" />
      <Alert>
        <FlaskConical />
        <AlertDescription>درگاه بانکی واقعی متصل نیست؛ همه پرداخت‌ها شبیه‌سازی‌شده و با برچسب «شبیه‌سازی» مشخص شده‌اند.</AlertDescription>
      </Alert>
      <FilterLinks basePath={base} param="view" current={view === "wallet" ? "wallet" : ""} options={[{ value: "", label: "پرداخت‌ها" }, { value: "wallet", label: "تراکنش‌های کیف پول" }]} />
      {view === "wallet" ? (
        <WalletTransactionsTable
          transactions={(await adminListWalletTransactions()).map((t) => ({ ...t, owner: `${t.wallet.user.fullName} (${t.wallet.user.phone})` }))}
        />
      ) : (
        <>
          <FilterLinks
            basePath={base}
            param="status"
            current={status}
            options={[{ value: "", label: "همه" }, ...STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_META[s].label }))]}
          />
          <PaymentsTable payments={await adminListPayments({ status })} />
        </>
      )}
    </>
  );
}
