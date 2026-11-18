import { MessageSquareText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatDate } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { avatarSrc } from "@/features/avatars/rules";

export function Stars({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex gap-0.5", className)}
      aria-label={`${rating.toLocaleString("fa-IR")} از ۵`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-4",
            n <= Math.round(rating)
              ? "fill-warning text-warning"
              : "text-muted-foreground",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  status?: "PUBLISHED" | "HIDDEN";
  /** `id` + `avatarUpdatedAt` only for authorised (dashboard) views; public pages show the default avatar. */
  customer: { fullName: string; id?: string; avatarUpdatedAt?: Date | null };
  order: { service: { name: string } };
  actions?: React.ReactNode;
  subtitle?: string;
};

export function ReviewList({
  reviews,
  emptyText = "هنوز نظری ثبت نشده است",
}: {
  reviews: ReviewItem[];
  emptyText?: string;
}) {
  if (reviews.length === 0)
    return <EmptyState icon={MessageSquareText} title={emptyText} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reviews.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  name={r.customer.fullName}
                  src={
                    r.customer.id
                      ? avatarSrc(r.customer.id, r.customer.avatarUpdatedAt)
                      : null
                  }
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {r.customer.fullName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.order.service.name}
                    {r.subtitle ? ` · ${r.subtitle}` : ""} ·{" "}
                    {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
              {r.status === "HIDDEN" ? (
                <Badge variant="outline">پنهان</Badge>
              ) : null}
            </div>
            <Stars rating={r.rating} />
            {r.comment ? (
              <p className="text-sm leading-7 text-muted-foreground">
                {r.comment}
              </p>
            ) : null}
            {r.actions}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
