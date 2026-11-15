"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/features/account/actions";
import { updateProfileSchema, type UpdateProfileInput } from "@/features/auth/schemas";

export function ProfileForm({ defaultValues, phone }: { defaultValues: UpdateProfileInput; phone: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema), defaultValues });
  const { errors } = form.formState;

  function onSubmit() {
    const values = form.getValues();
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(key as Path<UpdateProfileInput>, { message: messages[0] });
        }
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="phone">شماره موبایل</FieldLabel>
          <Input id="phone" value={phone} disabled dir="ltr" className="text-left" readOnly />
          <FieldDescription>شماره موبایل شناسه ورود شماست و از این بخش قابل تغییر نیست.</FieldDescription>
        </Field>

        <Field data-invalid={!!errors.fullName}>
          <FieldLabel htmlFor="fullName">نام و نام خانوادگی</FieldLabel>
          <Input id="fullName" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
          <FieldError errors={[errors.fullName]} />
        </Field>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">ایمیل</FieldLabel>
          <Input id="email" type="email" dir="ltr" className="text-left" aria-invalid={!!errors.email} {...form.register("email")} />
          <FieldError errors={[errors.email]} />
        </Field>

        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          ذخیره تغییرات
        </Button>
      </FieldGroup>
    </form>
  );
}
