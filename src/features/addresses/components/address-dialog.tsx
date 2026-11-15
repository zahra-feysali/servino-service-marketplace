"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { saveAddressAction } from "@/features/addresses/actions";

type Province = { id: string; name: string; cities: { id: string; name: string }[] };
type Address = { id: string; title: string; cityId: string; line: string; postalCode: string | null; isDefault: boolean };

export function AddressDialog({ provinces, address, trigger }: { provinces: Province[]; address?: Address; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{address ? "ویرایش نشانی" : "نشانی جدید"}</DialogTitle>
          <DialogDescription>نشانی‌های ذخیره‌شده در ثبت درخواست قابل انتخاب هستند.</DialogDescription>
        </DialogHeader>
        <ServerForm action={saveAddressAction.bind(null, address?.id ?? null)} onSuccess={() => setOpen(false)} resetOnSuccess={!address}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="addr-title">عنوان</FieldLabel>
                <Input id="addr-title" name="title" defaultValue={address?.title} placeholder="خانه، محل کار…" required />
                <FormFieldError name="title" />
              </Field>
              <Field>
                <FieldLabel htmlFor="addr-city">شهر</FieldLabel>
                <NativeSelect id="addr-city" name="cityId" className="w-full" defaultValue={address?.cityId ?? ""}>
                  <NativeSelectOption value="">انتخاب شهر…</NativeSelectOption>
                  {provinces.map((p) => (
                    <NativeSelectOptGroup key={p.id} label={p.name}>
                      {p.cities.map((c) => (
                        <NativeSelectOption key={c.id} value={c.id}>
                          {c.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  ))}
                </NativeSelect>
                <FormFieldError name="cityId" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="addr-line">نشانی کامل</FieldLabel>
              <Textarea id="addr-line" name="line" rows={2} defaultValue={address?.line} required />
              <FormFieldError name="line" />
            </Field>
            <Field>
              <FieldLabel htmlFor="addr-postal">کد پستی (اختیاری)</FieldLabel>
              <Input id="addr-postal" name="postalCode" inputMode="numeric" dir="ltr" className="text-left" defaultValue={address?.postalCode ?? ""} maxLength={10} />
              <FormFieldError name="postalCode" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="size-4 accent-[var(--primary)]" />
              نشانی پیش‌فرض
            </label>
            <SubmitButton className="justify-self-start">ذخیره</SubmitButton>
          </FieldGroup>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}
