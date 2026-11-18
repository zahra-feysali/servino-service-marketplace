"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import type { ActionResult } from "@/lib/errors";

/**
 * Admin records a bank transfer that was already made OUTSIDE the application.
 * Requires the transfer tracking code and an explicit confirmation checkbox.
 */
export function MarkPaidDialog({
  action,
  amountLabel,
  destination,
}: {
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  amountLabel: string;
  destination: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <BadgeCheck />
          ثبت پرداخت دستی
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ثبت پرداخت انجام‌شده</DialogTitle>
          <DialogDescription className="leading-7">
            این عملیات هیچ انتقال بانکی انجام نمی‌دهد. فقط وقتی ثبت کنید که {amountLabel} را خودتان (خارج از سایت) به حساب{" "}
            <span dir="ltr" className="font-mono">
              {destination}
            </span>{" "}
            منتقل کرده‌اید. پس از ثبت، مبلغ یک بار از کیف پول متخصص کسر می‌شود و قابل بازگشت نیست.
          </DialogDescription>
        </DialogHeader>
        <ServerForm action={action} onSuccess={() => setOpen(false)} className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="reference">کد پیگیری انتقال بانکی *</FieldLabel>
            <Input id="reference" name="reference" dir="ltr" className="text-left font-mono" maxLength={64} required autoComplete="off" />
            <FieldDescription>کد پیگیری یا شماره مرجع پایا/ساتنا (حروف انگلیسی، عدد و خط تیره)</FieldDescription>
            <FormFieldError name="reference" />
          </Field>
          <Field>
            <FieldLabel htmlFor="note">یادداشت مدیر (اختیاری)</FieldLabel>
            <Textarea id="note" name="note" maxLength={1000} />
            <FormFieldError name="note" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="confirm" name="confirm" />
            <FieldLabel htmlFor="confirm" className="font-normal leading-6">
              تأیید می‌کنم انتقال بانکی این مبلغ را خارج از سایت انجام داده‌ام.
            </FieldLabel>
          </Field>
          <FormFieldError name="confirm" />
          <SubmitButton className="self-start">ثبت پرداخت</SubmitButton>
        </ServerForm>
      </DialogContent>
    </Dialog>
  );
}
