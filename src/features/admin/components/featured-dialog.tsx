"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { JalaliDatePicker } from "@/components/shared/jalali-date-picker";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { adminSaveFeaturedAction } from "@/features/admin/actions";
import { PLACEMENTS, PLACEMENT_LABELS } from "@/features/featured/rules";

type Featured = { id: string; providerId: string; placement: (typeof PLACEMENTS)[number]; startsAt: string; endsAt: string; price: number | null; sortOrder: number; isActive: boolean };

export function FeaturedDialog({
  providers,
  featured,
  trigger,
  defaultRange,
}: {
  providers: { id: string; displayName: string }[];
  featured?: Featured;
  trigger: React.ReactNode;
  /** default [start, end] as YYYY-MM-DD, computed on the server */
  defaultRange: [string, string];
}) {
  const [open, setOpen] = useState(false);
  const [today, in30] = defaultRange;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{featured ? "ویرایش نمایش ویژه" : "افزودن متخصص ویژه"}</DialogTitle>
          <DialogDescription>نمایش ویژه مستقل از اشتراک است و ترتیب نمایش را سرور تعیین می‌کند.</DialogDescription>
        </DialogHeader>
        <ServerForm action={adminSaveFeaturedAction.bind(null, featured?.id ?? null)} onSuccess={() => setOpen(false)}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="f-provider">متخصص (تأییدشده)</FieldLabel>
              <NativeSelect id="f-provider" name="providerId" className="w-full" defaultValue={featured?.providerId ?? ""}>
                <NativeSelectOption value="">انتخاب کنید…</NativeSelectOption>
                {providers.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.displayName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FormFieldError name="providerId" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="f-place">جایگاه</FieldLabel>
                <NativeSelect id="f-place" name="placement" className="w-full" defaultValue={featured?.placement ?? "HOME"}>
                  {PLACEMENTS.map((p) => (
                    <NativeSelectOption key={p} value={p}>
                      {PLACEMENT_LABELS[p]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="f-sort">ترتیب</FieldLabel>
                <Input id="f-sort" name="sortOrder" type="number" min={0} dir="ltr" defaultValue={featured?.sortOrder ?? 0} />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-start">شروع</FieldLabel>
                <JalaliDatePicker id="f-start" name="startsAt" defaultValue={featured?.startsAt ?? today} clearable={false} />
                <FormFieldError name="startsAt" />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-end">پایان</FieldLabel>
                <JalaliDatePicker id="f-end" name="endsAt" defaultValue={featured?.endsAt ?? in30} clearable={false} />
                <FormFieldError name="endsAt" />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-price">هزینه (تومان، اختیاری)</FieldLabel>
                <Input id="f-price" name="price" inputMode="numeric" dir="ltr" defaultValue={featured?.price ?? ""} />
                <FormFieldError name="price" />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={featured?.isActive ?? true} className="size-4 accent-[var(--primary)]" />
                فعال
              </label>
            </div>
            <SubmitButton className="justify-self-start">ذخیره</SubmitButton>
          </FieldGroup>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}
