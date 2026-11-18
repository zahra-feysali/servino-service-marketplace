import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { OpenChatButton } from "@/features/chat/components/open-chat-button";
import { getOrderDetail } from "@/features/orders/service";
import { getProviderProfileByUserId } from "@/features/providers/service";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "جزئیات سفارش" };

export default async function ProviderOrderPage({ params }: PageProps<"/dashboard/provider/orders/[id]">) {
  const user = await requireRolePage("PROVIDER");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const profile = await getProviderProfileByUserId(user.id);
  const order = await getOrderDetail({ kind: "provider", providerId: profile.id }, id);
  if (!order) notFound();

  const reviewSlot =
    order.review && order.review.status === "PUBLISHED" ? (
      <div className="space-y-2 rounded-xl border p-4">
        <p className="text-sm font-semibold">نظر مشتری</p>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={cn("size-5", n <= order.review!.rating ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
          ))}
        </div>
        {order.review.comment ? <p className="text-sm text-muted-foreground">{order.review.comment}</p> : null}
      </div>
    ) : null;

  return <OrderDetail order={order} headerActions={<OpenChatButton requestId={order.request.id} label="گفتگو با مشتری" />} viewerRole="PROVIDER" reviewSlot={reviewSlot} />;
}
