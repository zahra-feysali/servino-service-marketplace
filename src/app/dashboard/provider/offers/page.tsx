import type { Metadata } from "next";
import Link from "next/link";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { withdrawOfferAction } from "@/features/marketplace/actions";
import { listProviderOffers } from "@/features/offers/service";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { DURATION_UNIT_LABELS, OFFER_STATUS_META } from "@/features/requests/labels";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "پیشنهادهای من" };

export default async function ProviderOffersPage() {
  const user = await requireRolePage("PROVIDER");
  const profile = await getProviderProfileByUserId(user.id);
  const offers = await listProviderOffers(profile.id);

  return (
    <>
      <PageHeader title="پیشنهادهای من" description="وضعیت پیشنهادهای ارسال‌شده" />
      {offers.length === 0 ? (
        <EmptyState icon={Send} title="هنوز پیشنهادی ارسال نکرده‌اید" />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">درخواست</TableHead>
                <TableHead className="text-start">خدمت</TableHead>
                <TableHead className="text-start">قیمت</TableHead>
                <TableHead className="text-start">زمان</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{toPersianDigits(o.request.code)}</TableCell>
                  <TableCell className="font-medium">
                    {o.request.service.name}
                    <span className="block text-xs text-muted-foreground">{o.request.city.name}</span>
                  </TableCell>
                  <TableCell>{formatPrice(o.price)}</TableCell>
                  <TableCell>
                    {toPersianDigits(o.estimatedDuration)} {DURATION_UNIT_LABELS[o.estimatedDurationUnit]}
                  </TableCell>
                  <TableCell>
                    <Badge variant={OFFER_STATUS_META[o.status].variant}>{OFFER_STATUS_META[o.status].label}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(o.createdAt)}</TableCell>
                  <TableCell className="flex gap-1">
                    {o.order ? (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/provider/orders/${o.order.id}`}>سفارش</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/provider/requests/${o.request.id}`}>درخواست</Link>
                      </Button>
                    )}
                    {o.status === "PENDING" && o.request.status === "OPEN" ? (
                      <ActionButton
                        action={withdrawOfferAction.bind(null, o.id)}
                        size="sm"
                        variant="ghost"
                        confirm={{ title: "انصراف از پیشنهاد؟", description: "سهمیه مصرف‌شده بازگردانده نمی‌شود.", confirmLabel: "انصراف", destructive: true }}
                      >
                        انصراف
                      </ActionButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
