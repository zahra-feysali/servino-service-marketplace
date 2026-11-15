import type { Metadata } from "next";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { parsePage } from "@/lib/pagination";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { ActionButton } from "@/components/shared/action-button";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { adminSetReviewStatusAction } from "@/features/admin/actions";
import { adminListReviews } from "@/features/admin/queries";
import { ReviewList } from "@/features/reviews/components/review-list";
import { requireRolePage } from "@/lib/authz";
import { toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "نظرات" };

export default async function AdminReviewsPage({ searchParams }: PageProps<"/dashboard/admin/reviews">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const raw = sp.status;
  const status = pickParam(raw, ["PUBLISHED", "HIDDEN"] as const);
  const reviews = await adminListReviews(status, parsePage(sp.page));

  return (
    <>
      <PageHeader title="مدیریت نظرات" description="نظرات پنهان در امتیاز متخصص محاسبه نمی‌شوند؛ امتیاز پس از هر تغییر دوباره محاسبه می‌شود." />
      <FilterLinks
        basePath="/dashboard/admin/reviews"
        param="status"
        current={status}
        options={[
          { value: "", label: "همه" },
          { value: "PUBLISHED", label: "منتشرشده" },
          { value: "HIDDEN", label: "پنهان" },
        ]}
      />
      <ReviewList
        reviews={reviews.items.map((r) => ({
          ...r,
          subtitle: `${r.provider.displayName} · سفارش ${toPersianDigits(r.order.code)}`,
          actions: (
            <div className="flex gap-2 pt-1">
              <Link href={`/dashboard/admin/orders/${r.order.id}`} className="text-xs text-primary hover:underline">
                مشاهده سفارش
              </Link>
              {r.status === "PUBLISHED" ? (
                <ActionButton
                  action={adminSetReviewStatusAction.bind(null, r.id, "HIDDEN")}
                  size="sm"
                  variant="outline"
                  confirm={{ title: "پنهان کردن نظر؟", description: "امتیاز متخصص بدون این نظر دوباره محاسبه می‌شود.", confirmLabel: "پنهان کن" }}
                >
                  <EyeOff />
                  پنهان کردن
                </ActionButton>
              ) : (
                <ActionButton action={adminSetReviewStatusAction.bind(null, r.id, "PUBLISHED")} size="sm" variant="outline">
                  <Eye />
                  انتشار
                </ActionButton>
              )}
            </div>
          ),
        }))}
      />
      <PaginationNav basePath="/dashboard/admin/reviews" params={sp} page={reviews.page} totalPages={reviews.totalPages} total={reviews.total} />
    </>
  );
}
