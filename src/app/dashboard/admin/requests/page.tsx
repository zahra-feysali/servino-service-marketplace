import type { Metadata } from "next";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { parsePage } from "@/lib/pagination";
import Link from "next/link";
import { ClipboardList, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { adminListOffers, adminListRequests } from "@/features/admin/queries";
import { DURATION_UNIT_LABELS, OFFER_STATUS_META, REQUEST_STATUS_META, effectiveRequestStatus } from "@/features/requests/labels";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "درخواست‌ها و پیشنهادها" };
const STATUSES = ["OPEN", "PROVIDER_SELECTED", "COMPLETED", "CANCELLED"] as const;
const OFFER_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;

export default async function AdminRequestsPage({ searchParams }: PageProps<"/dashboard/admin/requests">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const view = sp.view === "offers" ? "offers" : "requests";
  const base = "/dashboard/admin/requests";

  return (
    <>
      <PageHeader title="درخواست‌ها و پیشنهادها" description="نظارت بر درخواست‌ها، پیشنهادها و درخواست‌های گزارش‌شده" />
      <FilterLinks basePath={base} param="view" current={view === "offers" ? "offers" : ""} options={[{ value: "", label: "درخواست‌ها" }, { value: "offers", label: "پیشنهادها" }]} />
      {view === "offers" ? <OffersView status={pickParam(sp.status, OFFER_STATUSES)} sp={sp} /> : <RequestsView sp={sp} />}
    </>
  );
}

async function RequestsView({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const status = pickParam(sp.status, STATUSES);
  const flagged = sp.flagged === "1";
  const code = typeof sp.code === "string" && /^\d{1,9}$/.test(sp.code) ? Number(sp.code) : undefined;
  const requests = await adminListRequests({ status, flagged, code }, parsePage(sp.page));
  const base = "/dashboard/admin/requests";

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <FilterLinks
          basePath={base}
          param="status"
          current={status}
          extra={{ flagged: flagged ? "1" : undefined }}
          options={[{ value: "", label: "همه" }, ...STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_META[s].label }))]}
        />
        <Button asChild size="sm" variant={flagged ? "destructive" : "outline"}>
          <Link href={flagged ? base : `${base}?flagged=1`}>
            <Flag />
            {flagged ? "نمایش همه" : "فقط گزارش‌شده‌ها"}
          </Link>
        </Button>
        <form action={base} className="flex gap-2">
          <input name="code" inputMode="numeric" placeholder="شماره درخواست" className="h-8 w-36 rounded-lg border bg-transparent px-2 text-sm" aria-label="جستجوی شماره" />
          <Button size="sm" variant="outline" type="submit">جستجو</Button>
        </form>
      </div>
      {requests.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="درخواستی یافت نشد" />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">شماره</TableHead>
                <TableHead className="text-start">خدمت</TableHead>
                <TableHead className="text-start">مشتری</TableHead>
                <TableHead className="text-start">شهر</TableHead>
                <TableHead className="text-start">متخصصان مطلع / پیشنهاد</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.items.map((r) => {
                const s = effectiveRequestStatus(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {toPersianDigits(r.code)}
                      {r.isFlagged ? <Flag className="ms-1 inline size-4 text-destructive" aria-label="گزارش‌شده" /> : null}
                    </TableCell>
                    <TableCell className="font-medium">{r.service.name}</TableCell>
                    <TableCell>{r.customer.fullName}</TableCell>
                    <TableCell>{r.city.name}</TableCell>
                    <TableCell>
                      {toPersianDigits(r._count.matches)} / {toPersianDigits(r.offerCount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={REQUEST_STATUS_META[s].variant}>{REQUEST_STATUS_META[s].label}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`${base}/${r.id}`}>بررسی</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationNav basePath={base} params={sp} page={requests.page} totalPages={requests.totalPages} total={requests.total} />
    </>
  );
}

async function OffersView({ status, sp }: { status?: (typeof OFFER_STATUSES)[number]; sp: Record<string, string | string[] | undefined> }) {
  const offers = await adminListOffers(status, parsePage(sp.page));
  return (
    <>
      <FilterLinks
        basePath="/dashboard/admin/requests"
        param="status"
        current={status}
        extra={{ view: "offers" }}
        options={[{ value: "", label: "همه" }, ...OFFER_STATUSES.map((s) => ({ value: s, label: OFFER_STATUS_META[s].label }))]}
      />
      {offers.items.length === 0 ? (
        <EmptyState title="پیشنهادی یافت نشد" />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">درخواست</TableHead>
                <TableHead className="text-start">متخصص</TableHead>
                <TableHead className="text-start">قیمت</TableHead>
                <TableHead className="text-start">زمان</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">تاریخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/dashboard/admin/requests/${o.request.id}`} className="text-primary hover:underline">
                      {toPersianDigits(o.request.code)} — {o.request.service.name}
                    </Link>
                  </TableCell>
                  <TableCell>{o.provider.displayName}</TableCell>
                  <TableCell>{formatPrice(o.price)}</TableCell>
                  <TableCell>
                    {toPersianDigits(o.estimatedDuration)} {DURATION_UNIT_LABELS[o.estimatedDurationUnit]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={OFFER_STATUS_META[o.status].variant}>{OFFER_STATUS_META[o.status].label}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(o.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationNav basePath="/dashboard/admin/requests" params={sp} page={offers.page} totalPages={offers.totalPages} total={offers.total} />
    </>
  );
}
