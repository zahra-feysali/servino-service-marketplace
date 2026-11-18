import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrderDetail } from "@/features/orders/service";
import { getWalletBalance } from "@/features/payments/service";
import { ReviewForm } from "@/features/reviews/components/review-form";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default async function CustomerOrderPage({ params }: PageProps<"/dashboard/customer/orders/[id]">) {
  const user = await requireRolePage("CUSTOMER");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const order = await getOrderDetail({ kind: "customer", customerId: user.id }, id);
  if (!order) notFound();

  const reviewSlot =
    order.status !== "COMPLETED" ? null : order.review ? (
      <div className="space-y-2 rounded-xl border p-4">
        <p className="text-sm font-semibold">نظر ثبت‌شده شما ({formatDate(order.review.createdAt)})</p>
        <div className="flex gap-0.5" aria-label={`${order.review.rating} از ۵`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("size-5", n <= order.review!.rating ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
          ))}
        </div>
        {order.review.comment ? <p className="text-sm text-muted-foreground">{order.review.comment}</p> : null}
      </div>
    ) : (
      <ReviewForm orderId={order.id} />
    );

  const wallet = await getWalletBalance(user.id);
  return <OrderDetail order={order} viewerRole="CUSTOMER" reviewSlot={reviewSlot} walletBalance={wallet} />;
}
