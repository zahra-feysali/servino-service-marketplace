"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { adminSavePlanAction } from "@/features/admin/actions";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  durationDays: number;
  maxRequestsPerPeriod: number | null;
  maxOffersPerPeriod: number | null;
  features: string[];
  isActive: boolean;
  sortOrder: number;
};

export function PlanDialog({ plan, trigger }: { plan?: Plan; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{plan ? `ویرایش پلن ${plan.name}` : "پلن جدید"}</DialogTitle>
          <DialogDescription>تغییر پلن روی اشتراک‌های خریداری‌شده قبلی اثری ندارد (شرایط هنگام خرید ذخیره می‌شود).</DialogDescription>
        </DialogHeader>
        <ServerForm action={adminSavePlanAction.bind(null, plan?.id ?? null)} onSuccess={() => setOpen(false)}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="p-name">نام</FieldLabel>
                <Input id="p-name" name="name" defaultValue={plan?.name} required />
                <FormFieldError name="name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-slug">نامک</FieldLabel>
                <Input id="p-slug" name="slug" dir="ltr" className="text-left" defaultValue={plan?.slug} required />
                <FormFieldError name="slug" />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-price">قیمت (تومان)</FieldLabel>
                <Input id="p-price" name="price" inputMode="numeric" dir="ltr" defaultValue={plan?.price ?? ""} required />
                <FormFieldError name="price" />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-days">مدت (روز)</FieldLabel>
                <Input id="p-days" name="durationDays" type="number" min={1} dir="ltr" defaultValue={plan?.durationDays ?? 30} required />
                <FormFieldError name="durationDays" />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-req">سقف دریافت درخواست</FieldLabel>
                <Input id="p-req" name="maxRequestsPerPeriod" type="number" min={1} dir="ltr" defaultValue={plan?.maxRequestsPerPeriod ?? ""} />
                <FieldDescription>خالی = نامحدود</FieldDescription>
                <FormFieldError name="maxRequestsPerPeriod" />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-off">سقف ارسال پیشنهاد</FieldLabel>
                <Input id="p-off" name="maxOffersPerPeriod" type="number" min={1} dir="ltr" defaultValue={plan?.maxOffersPerPeriod ?? ""} />
                <FieldDescription>خالی = نامحدود</FieldDescription>
                <FormFieldError name="maxOffersPerPeriod" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="p-desc">توضیحات</FieldLabel>
              <Input id="p-desc" name="description" defaultValue={plan?.description ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="p-feat">ویژگی‌ها (هر خط یک ویژگی)</FieldLabel>
              <Textarea id="p-feat" name="features" rows={3} defaultValue={plan?.features.join("\n")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="p-sort">ترتیب نمایش</FieldLabel>
                <Input id="p-sort" name="sortOrder" type="number" min={0} dir="ltr" defaultValue={plan?.sortOrder ?? 0} />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} className="size-4 accent-[var(--primary)]" />
                فعال (قابل خرید)
              </label>
            </div>
            <SubmitButton className="justify-self-start">ذخیره</SubmitButton>
          </FieldGroup>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}
