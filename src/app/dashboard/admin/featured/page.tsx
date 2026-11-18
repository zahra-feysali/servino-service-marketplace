import type { Metadata } from "next";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { adminDeleteFeaturedAction } from "@/features/admin/actions";
import { FeaturedDialog } from "@/features/admin/components/featured-dialog";
import { PLACEMENT_LABELS, isFeaturedLive } from "@/features/featured/rules";
import { adminListFeatured, listApprovedProviderOptions } from "@/features/featured/service";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "متخصصان ویژه" };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminFeaturedPage() {
  await requireRolePage("ADMIN");
  const [items, providers] = await Promise.all([adminListFeatured(), listApprovedProviderOptions()]);
  const now = new Date();
  const defaultRange: [string, string] = [iso(now), iso(new Date(now.getTime() + 30 * 86_400_000))];

  return (
    <>
      <PageHeader
        title="متخصصان ویژه"
        description="متخصصان ویژه در جایگاه انتخاب‌شده (صفحه اصلی، صفحات خدمات، جستجو) بالاتر از بقیه نمایش داده می‌شوند."
        actions={
          <FeaturedDialog
            defaultRange={defaultRange}
            providers={providers}
            trigger={
              <Button disabled={providers.length === 0}>
                <Plus />
                افزودن
              </Button>
            }
          />
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Sparkles} title="متخصص ویژه‌ای تعریف نشده است" />
      ) : (
        <div className="rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">متخصص</TableHead>
                <TableHead className="text-start">جایگاه</TableHead>
                <TableHead className="text-start">بازه</TableHead>
                <TableHead className="text-start">هزینه</TableHead>
                <TableHead className="text-start">ترتیب</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => {
                const live = isFeaturedLive(f, now) && f.provider.verificationStatus === "APPROVED";
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.provider.displayName}</TableCell>
                    <TableCell>{PLACEMENT_LABELS[f.placement]}</TableCell>
                    <TableCell className="text-xs">
                      {formatDate(f.startsAt)} تا {formatDate(f.endsAt)}
                    </TableCell>
                    <TableCell>{f.price !== null ? formatPrice(f.price) : "—"}</TableCell>
                    <TableCell>{toPersianDigits(f.sortOrder)}</TableCell>
                    <TableCell>
                      <Badge variant={live ? "default" : "outline"}>{live ? "در حال نمایش" : f.isActive ? "خارج از بازه" : "غیرفعال"}</Badge>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <FeaturedDialog
            defaultRange={defaultRange}
                        providers={providers}
                        featured={{ id: f.id, providerId: f.provider.id, placement: f.placement, startsAt: iso(f.startsAt), endsAt: iso(f.endsAt), price: f.price, sortOrder: f.sortOrder, isActive: f.isActive }}
                        trigger={
                          <Button size="icon-sm" variant="ghost" aria-label="ویرایش">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ActionButton action={adminDeleteFeaturedAction.bind(null, f.id)} size="icon-sm" variant="ghost" confirm={{ title: "حذف این مورد؟", confirmLabel: "حذف", destructive: true }}>
                        <Trash2 />
                        <span className="sr-only">حذف</span>
                      </ActionButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
