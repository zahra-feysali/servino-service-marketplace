import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ORDER_STATUS_META } from "@/features/orders/labels";
import type { listCustomerOrders } from "@/features/orders/service";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

type Orders = Awaited<ReturnType<typeof listCustomerOrders>>;

export function OrdersTable({ orders, basePath, counterpart }: { orders: Orders; basePath: string; counterpart: "provider" | "customer" }) {
  if (orders.length === 0) {
    return <EmptyState icon={PackageOpen} title="سفارشی ندارید" description="پس از انتخاب یک پیشنهاد، سفارش اینجا نمایش داده می‌شود." />;
  }
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">شماره</TableHead>
            <TableHead className="text-start">خدمت</TableHead>
            <TableHead className="text-start">{counterpart === "provider" ? "متخصص" : "مشتری"}</TableHead>
            <TableHead className="text-start">مبلغ</TableHead>
            <TableHead className="text-start">وضعیت</TableHead>
            <TableHead className="text-start">تاریخ</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell>{toPersianDigits(o.code)}</TableCell>
              <TableCell className="font-medium">{o.service.name}</TableCell>
              <TableCell>{counterpart === "provider" ? o.provider.displayName : o.customer.fullName}</TableCell>
              <TableCell>{formatPrice(o.price)}</TableCell>
              <TableCell>
                <Badge variant={ORDER_STATUS_META[o.status].variant}>{ORDER_STATUS_META[o.status].label}</Badge>
              </TableCell>
              <TableCell>{formatDate(o.createdAt)}</TableCell>
              <TableCell>
                <Button asChild size="sm" variant="outline">
                  <Link href={`${basePath}/${o.id}`}>جزئیات</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
