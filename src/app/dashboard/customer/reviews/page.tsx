import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { listCustomerReviews } from "@/features/reviews/service";
import { requireRolePage } from "@/lib/authz";
import { cn, formatDate, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "نظرات من" };

export default async function CustomerReviewsPage() {
  const user = await requireRolePage("CUSTOMER");
  const reviews = await listCustomerReviews(user.id);

  return (
    <>
      <PageHeader title="نظرات من" description="امتیازها و نظراتی که برای سفارش‌های تکمیل‌شده ثبت کرده‌اید" />
      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="هنوز نظری ثبت نکرده‌اید" description="پس از تکمیل هر سفارش می‌توانید به متخصص امتیاز دهید." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.provider.displayName}</p>
                    <Link href={`/dashboard/customer/orders/${r.order.id}`} className="text-xs text-primary hover:underline">
                      سفارش {toPersianDigits(r.order.code)} — {r.order.service.name}
                    </Link>
                  </div>
                  {r.status === "HIDDEN" ? <Badge variant="outline">پنهان‌شده توسط مدیر</Badge> : null}
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={cn("size-4", n <= r.rating ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
                  ))}
                </div>
                {r.comment ? <p className="text-sm text-muted-foreground">{r.comment}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
