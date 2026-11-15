import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { getProviderRatingSummary, listProviderReviews } from "@/features/providers/public-queries";
import { ReviewList, Stars } from "@/features/reviews/components/review-list";
import { requireRolePage } from "@/lib/authz";
import { toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "نظرات مشتریان" };

export default async function ProviderReviewsPage() {
  const user = await requireRolePage("PROVIDER");
  const profile = await getProviderProfileByUserId(user.id);
  const [reviews, agg] = await Promise.all([
    listProviderReviews(profile.id),
    getProviderRatingSummary(profile.id),
  ]);

  return (
    <>
      <PageHeader
        title="نظرات مشتریان"
        description="نظرات پنهان‌شده توسط مدیر در امتیاز شما محاسبه نمی‌شوند."
        actions={
          agg && agg.ratingCount > 0 ? (
            <span className="flex items-center gap-2 text-sm">
              <Stars rating={agg.ratingAverage} />
              {agg.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} از {toPersianDigits(agg.ratingCount)} نظر
            </span>
          ) : null
        }
      />
      <ReviewList reviews={reviews} />
    </>
  );
}
