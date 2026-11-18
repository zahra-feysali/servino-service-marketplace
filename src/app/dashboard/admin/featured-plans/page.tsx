import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { deleteFeaturedPlanAction, saveFeaturedPlanAction } from "@/features/featured/purchase-actions";
import { adminListFeaturedPlans } from "@/features/featured/purchase-service";
import { PLACEMENTS, PLACEMENT_LABELS } from "@/features/featured/rules";
import { requireRolePage } from "@/lib/authz";
import { formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "پلن‌های ویژه" };

type Plan = Awaited<ReturnType<typeof adminListFeaturedPlans>>[number];

function PlanFields({ plan }: { plan?: Plan }) {
  const k = plan?.id ?? "new";
  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`name-${k}`}>نام پلن</FieldLabel>
          <Input id={`name-${k}`} name="name" required maxLength={80} defaultValue={plan?.name} />
          <FormFieldError name="name" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`slug-${k}`}>نامک</FieldLabel>
          <Input id={`slug-${k}`} name="slug" required dir="ltr" className="text-end" placeholder="home-30" defaultValue={plan?.slug} />
          <FormFieldError name="slug" />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`desc-${k}`}>توضیح</FieldLabel>
        <Input id={`desc-${k}`} name="description" maxLength={300} defaultValue={plan?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor={`placement-${k}`}>جایگاه</FieldLabel>
          <NativeSelect id={`placement-${k}`} name="placement" className="w-full" defaultValue={plan?.placement ?? "HOME"}>
            {PLACEMENTS.map((p) => (
              <NativeSelectOption key={p} value={p}>
                {PLACEMENT_LABELS[p]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor={`days-${k}`}>مدت (روز)</FieldLabel>
          <Input id={`days-${k}`} name="durationDays" type="number" min={1} max={365} dir="ltr" required defaultValue={plan?.durationDays ?? 30} />
          <FormFieldError name="durationDays" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`price-${k}`}>قیمت (تومان)</FieldLabel>
          <Input id={`price-${k}`} name="price" inputMode="numeric" dir="ltr" required defaultValue={plan?.price ?? ""} />
          <FormFieldError name="price" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`sort-${k}`}>ترتیب</FieldLabel>
          <Input id={`sort-${k}`} name="sortOrder" type="number" min={0} max={999} dir="ltr" defaultValue={plan?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field orientation="horizontal">
        <Checkbox id={`active-${k}`} name="isActive" defaultChecked={plan?.isActive ?? true} />
        <FieldLabel htmlFor={`active-${k}`} className="font-normal">
          قابل خرید برای متخصصان
        </FieldLabel>
      </Field>
    </FieldGroup>
  );
}

export default async function AdminFeaturedPlansPage() {
  await requireRolePage("ADMIN");
  const plans = await adminListFeaturedPlans();
  return (
    <>
      <PageHeader
        icon={Sparkles}
        title="پلن‌های ویژه"
        description="پلن‌هایی که متخصصان برای نمایش ویژه می‌خرند (پرداخت با کیف پول یا درگاه؛ فعال‌سازی و انقضای خودکار)."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/featured">
              <ArrowRight />
              جایگاه‌های ویژه
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">پلن جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerForm action={saveFeaturedPlanAction.bind(null, null)} resetOnSuccess className="space-y-4">
            <PlanFields />
            <SubmitButton>ایجاد پلن</SubmitButton>
          </ServerForm>
        </CardContent>
      </Card>
      {plans.length === 0 ? (
        <EmptyState icon={Sparkles} title="هنوز پلن ویژه‌ای تعریف نشده است" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {p.name}
                  <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "فعال" : "غیرفعال"}</Badge>
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatPrice(p.price)} · {toPersianDigits(p.purchaseCount)} خرید
                  </span>
                </CardTitle>
                <ActionButton
                  action={deleteFeaturedPlanAction.bind(null, p.id)}
                  size="sm"
                  variant="ghost"
                  confirm={{ title: `حذف پلن «${p.name}»؟`, description: "اگر این پلن خرید داشته باشد، به‌جای حذف غیرفعال می‌شود.", confirmLabel: "حذف", destructive: true }}
                >
                  <Trash2 />
                  حذف
                </ActionButton>
              </CardHeader>
              <CardContent>
                <ServerForm action={saveFeaturedPlanAction.bind(null, p.id)} className="space-y-4">
                  <PlanFields plan={p} />
                  <SubmitButton variant="outline">ذخیره تغییرات</SubmitButton>
                </ServerForm>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
