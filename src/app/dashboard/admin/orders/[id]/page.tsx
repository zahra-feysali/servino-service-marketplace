import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrderDetail } from "@/features/orders/service";
import { Stars } from "@/features/reviews/components/review-list";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default async function AdminOrderPage({ params }: PageProps<"/dashboard/admin/orders/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const order = await getOrderDetail({ kind: "admin" }, id);
  if (!order) notFound();

  const reviewSlot = order.review ? (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="text-sm font-semibold">نظر مشتری {order.review.status === "HIDDEN" ? "(پنهان)" : ""}</p>
      <Stars rating={order.review.rating} />
      {order.review.comment ? <p className="text-sm text-muted-foreground">{order.review.comment}</p> : null}
    </div>
  ) : null;

  return <OrderDetail order={order} viewerRole="ADMIN" reviewSlot={reviewSlot} />;
}
