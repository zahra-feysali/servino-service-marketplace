import { MessageSquareText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatDate } from "@/lib/utils";

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`${rating.toLocaleString("fa-IR")} از ۵`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
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
  customer: { fullName: string };
  order: { service: { name: string } };
  actions?: React.ReactNode;
  subtitle?: string;
};

export function ReviewList({ reviews, emptyText = "هنوز نظری ثبت نشده است" }: { reviews: ReviewItem[]; emptyText?: string }) {
  if (reviews.length === 0) return <EmptyState icon={MessageSquareText} title={emptyText} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reviews.map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.customer.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.order.service.name}
                  {r.subtitle ? ` · ${r.subtitle}` : ""} · {formatDate(r.createdAt)}
                </p>
              </div>
              {r.status === "HIDDEN" ? <Badge variant="outline">پنهان</Badge> : null}
            </div>
            <Stars rating={r.rating} />
            {r.comment ? <p className="text-sm leading-7 text-muted-foreground">{r.comment}</p> : null}
            {r.actions}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
