"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { submitOfferAction } from "@/features/marketplace/actions";
import { offerInputSchema } from "@/features/offers/rules";

type Values = { price: string; estimatedDuration: string; estimatedDurationUnit: "HOUR" | "DAY"; description: string; notes: string };

export function OfferForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    resolver: zodResolver(offerInputSchema) as unknown as Resolver<Values>,
    defaultValues: { price: "", estimatedDuration: "", estimatedDurationUnit: "HOUR", description: "", notes: "" },
  });
  const { errors } = form.formState;

  function onSubmit() {
    const values = form.getValues();
    startTransition(async () => {
      const result = await submitOfferAction(requestId, values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [k, m] of Object.entries(result.fieldErrors ?? {})) if (m?.[0]) form.setError(k as Path<Values>, { message: m[0] });
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={!!errors.price} className="sm:col-span-1">
            <FieldLabel htmlFor="offer-price">قیمت پیشنهادی (تومان)</FieldLabel>
            <Input id="offer-price" inputMode="numeric" dir="ltr" className="text-left" placeholder="850000" {...form.register("price")} />
            <FieldError errors={[errors.price]} />
          </Field>
          <Field data-invalid={!!errors.estimatedDuration}>
            <FieldLabel htmlFor="offer-duration">زمان تقریبی انجام</FieldLabel>
            <Input id="offer-duration" type="number" min={1} dir="ltr" className="text-left" {...form.register("estimatedDuration")} />
            <FieldError errors={[errors.estimatedDuration]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="offer-unit">واحد زمان</FieldLabel>
            <NativeSelect id="offer-unit" className="w-full" {...form.register("estimatedDurationUnit")}>
              <NativeSelectOption value="HOUR">ساعت</NativeSelectOption>
              <NativeSelectOption value="DAY">روز</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="offer-desc">توضیحات پیشنهاد</FieldLabel>
          <Textarea id="offer-desc" rows={4} placeholder="شرح کار، مواد مصرفی، گارانتی و…" {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <Field data-invalid={!!errors.notes}>
          <FieldLabel htmlFor="offer-notes">یادداشت تکمیلی (اختیاری)</FieldLabel>
          <Textarea id="offer-notes" rows={2} {...form.register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
        <FieldDescription>ارسال هر پیشنهاد یک واحد از سهمیه پیشنهاد اشتراک شما را مصرف می‌کند.</FieldDescription>
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
          ارسال پیشنهاد
        </Button>
      </FieldGroup>
    </form>
  );
}
