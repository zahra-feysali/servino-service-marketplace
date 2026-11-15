import type { Metadata } from "next";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { deleteAddressAction } from "@/features/addresses/actions";
import { AddressDialog } from "@/features/addresses/components/address-dialog";
import { MAX_ADDRESSES } from "@/features/addresses/schemas";
import { listAddresses } from "@/features/addresses/service";
import { getActiveCitiesGrouped } from "@/features/requests/queries";
import { requireRolePage } from "@/lib/authz";
import { toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "نشانی‌ها" };

export default async function CustomerAddressesPage() {
  const user = await requireRolePage("CUSTOMER");
  const [addresses, provinces] = await Promise.all([listAddresses(user.id), getActiveCitiesGrouped()]);

  return (
    <>
      <PageHeader
        title="نشانی‌ها"
        description={`حداکثر ${toPersianDigits(MAX_ADDRESSES)} نشانی`}
        actions={
          <AddressDialog
            provinces={provinces}
            trigger={
              <Button disabled={addresses.length >= MAX_ADDRESSES}>
                <Plus />
                نشانی جدید
              </Button>
            }
          />
        }
      />
      {addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="نشانی ذخیره‌شده‌ای ندارید" description="با ذخیره نشانی، ثبت درخواست‌های بعدی سریع‌تر می‌شود." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {a.title}
                    {a.isDefault ? <Badge>پیش‌فرض</Badge> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.city.name} — {a.line}
                  </p>
                  {a.postalCode ? <p className="text-xs text-muted-foreground">کد پستی: <span className="ltr-nums">{a.postalCode}</span></p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <AddressDialog
                    provinces={provinces}
                    address={a}
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label="ویرایش">
                        <Pencil />
                      </Button>
                    }
                  />
                  <ActionButton
                    action={deleteAddressAction.bind(null, a.id)}
                    size="icon-sm"
                    variant="ghost"
                    confirm={{ title: "حذف نشانی؟", description: "درخواست‌های قبلی تغییری نمی‌کنند.", confirmLabel: "حذف", destructive: true }}
                  >
                    <Trash2 />
                    <span className="sr-only">حذف</span>
                  </ActionButton>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
