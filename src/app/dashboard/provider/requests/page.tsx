import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { OFFER_STATUS_META, REQUEST_STATUS_META, effectiveRequestStatus } from "@/features/requests/labels";
import { listProviderInbox } from "@/features/requests/queries";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "درخواست‌های مرتبط" };

export default async function ProviderRequestsPage({ searchParams }: PageProps<"/dashboard/provider/requests">) {
  const user = await requireRolePage("PROVIDER");
  const profile = await getProviderProfileByUserId(user.id);
  const { filter } = await searchParams;
  const active = filter === "all" ? "all" : "open";
  const items = await listProviderInbox(profile.id, active);

  return (
    <>
      <PageHeader
        title="درخواست‌های مرتبط"
        description="درخواست‌هایی که بر اساس خدمات، منطقه و اشتراک شما برایتان ارسال شده‌اند"
      />
      <nav className="flex gap-2" aria-label="فیلتر">
        <Button asChild size="sm" variant={active === "open" ? "default" : "outline"}>
          <Link href="/dashboard/provider/requests">باز</Link>
        </Button>
        <Button asChild size="sm" variant={active === "all" ? "default" : "outline"}>
          <Link href="/dashboard/provider/requests?filter=all">همه</Link>
        </Button>
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="درخواستی برای شما وجود ندارد"
          description={
            profile.verificationStatus !== "APPROVED"
              ? "تا زمان تأیید حساب حرفه‌ای، درخواستی برای شما ارسال نمی‌شود."
              : "درخواست‌های جدید متناسب با خدمات و مناطق شما اینجا نمایش داده می‌شوند (نیازمند اشتراک فعال)."
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
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">پیشنهاد من</TableHead>
                <TableHead className="text-start">تاریخ دریافت</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ request: r, viewedAt, createdAt }) => {
                const s = effectiveRequestStatus(r);
                const mine = r.offers[0];
                return (
                  <TableRow key={r.id} className={!viewedAt ? "bg-secondary/40" : undefined}>
                    <TableCell>
                      {toPersianDigits(r.code)}
                      {!viewedAt ? <Badge className="ms-2">جدید</Badge> : null}
                    </TableCell>
                    <TableCell className="font-medium">{r.service.name}</TableCell>
                    <TableCell>{r.city.name}</TableCell>
                    <TableCell>
                      <Badge variant={REQUEST_STATUS_META[s].variant}>{REQUEST_STATUS_META[s].label}</Badge>
                    </TableCell>
                    <TableCell>
                      {mine ? (
                        <span className="flex flex-col">
                          <span>{formatPrice(mine.price)}</span>
                          <span className="text-xs text-muted-foreground">{OFFER_STATUS_META[mine.status].label}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(createdAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/provider/requests/${r.id}`}>{!mine && s === "OPEN" ? "مشاهده و پیشنهاد" : "مشاهده"}</Link>
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
