import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { REQUEST_STATUS_META, effectiveRequestStatus } from "@/features/requests/labels";
import { listCustomerRequests } from "@/features/requests/queries";
import { requireRolePage } from "@/lib/authz";
import { cn, formatDate, toPersianDigits } from "@/lib/utils";
import type { RequestStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "درخواست‌های من" };

const FILTERS: { value: RequestStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "همه" },
  { value: "OPEN", label: "باز" },
  { value: "PROVIDER_SELECTED", label: "متخصص انتخاب‌شده" },
  { value: "COMPLETED", label: "تکمیل‌شده" },
  { value: "CANCELLED", label: "لغوشده" },
];

export default async function CustomerRequestsPage({ searchParams }: PageProps<"/dashboard/customer/requests">) {
  const user = await requireRolePage("CUSTOMER");
  const { status } = await searchParams;
  const active = FILTERS.find((f) => f.value === status)?.value ?? "ALL";
  const requests = await listCustomerRequests(user.id, active === "ALL" ? undefined : active);

  return (
    <>
      <PageHeader
        title="درخواست‌های من"
        description="درخواست‌های ثبت‌شده و پیشنهادهای دریافتی"
        actions={
          <Button asChild>
            <Link href="/services">
              <Plus />
              درخواست جدید
            </Link>
          </Button>
        }
      />

      <nav className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">
        {FILTERS.map((f) => (
          <Button key={f.value} asChild size="sm" variant={active === f.value ? "default" : "outline"}>
            <Link href={f.value === "ALL" ? "/dashboard/customer/requests" : `/dashboard/customer/requests?status=${f.value}`}>{f.label}</Link>
          </Button>
        ))}
      </nav>

      {requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="درخواستی یافت نشد"
          description="از صفحه خدمات، خدمت مورد نیاز را انتخاب و درخواست ثبت کنید."
          action={
            <Button asChild>
              <Link href="/services">مشاهده خدمات</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">شماره</TableHead>
                <TableHead className="text-start">خدمت</TableHead>
                <TableHead className="text-start">شهر</TableHead>
                <TableHead className="text-start">پیشنهادها</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">تاریخ ثبت</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const s = effectiveRequestStatus(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{toPersianDigits(r.code)}</TableCell>
                    <TableCell className="font-medium">{r.service.name}</TableCell>
                    <TableCell>{r.city.name}</TableCell>
                    <TableCell>
                      <span className={cn(r.offerCount > 0 && r.status === "OPEN" && "font-bold text-primary")}>{toPersianDigits(r.offerCount)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={REQUEST_STATUS_META[s].variant}>{REQUEST_STATUS_META[s].label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/customer/requests/${r.id}`}>جزئیات</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
