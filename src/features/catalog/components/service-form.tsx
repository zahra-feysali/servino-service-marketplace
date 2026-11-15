"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveServiceAction } from "@/features/catalog/admin-actions";
import { SERVICE_ICON_NAMES } from "@/features/catalog/icons";
import { serviceInputSchema, type ServiceInput } from "@/features/catalog/schemas";

type Props = {
  serviceId?: string;
  initial?: Partial<ServiceInput>;
  categoryOptions: { id: string; label: string }[];
  formId: string;
  onSaved?: () => void;
};

export function ServiceForm({ serviceId, initial, categoryOptions, formId, onSaved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceInputSchema) as never,
    defaultValues: {
      categoryId: "",
      name: "",
      slug: "",
      shortDescription: "",
      description: "",
      icon: "",
      isActive: true,
      sortOrder: 0,
      ...initial,
    },
  });
  const { errors } = form.formState;

  function onSubmit() {
    const values = form.getValues();
    startTransition(async () => {
      const result = await saveServiceAction(serviceId ?? null, values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [k, m] of Object.entries(result.fieldErrors ?? {})) if (m?.[0]) form.setError(k as Path<ServiceInput>, { message: m[0] });
        return;
      }
      toast.success(result.message);
      onSaved?.();
      if (!serviceId) router.push(`/dashboard/admin/catalog/services/${result.data.id}`);
      else router.refresh();
    });
  }

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor={`${formId}-name`}>نام خدمت</FieldLabel>
            <Input id={`${formId}-name`} {...form.register("name")} aria-invalid={!!errors.name} />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={!!errors.slug}>
            <FieldLabel htmlFor={`${formId}-slug`}>نامک (انگلیسی)</FieldLabel>
            <Input id={`${formId}-slug`} dir="ltr" className="text-left" placeholder="home-cleaning" {...form.register("slug")} aria-invalid={!!errors.slug} />
            <FieldDescription>در آدرس صفحه خدمت استفاده می‌شود.</FieldDescription>
            <FieldError errors={[errors.slug]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.categoryId}>
          <FieldLabel htmlFor={`${formId}-cat`}>دسته‌بندی</FieldLabel>
          <NativeSelect id={`${formId}-cat`} className="w-full" {...form.register("categoryId")} aria-invalid={!!errors.categoryId}>
            <NativeSelectOption value="">انتخاب کنید…</NativeSelectOption>
            {categoryOptions.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.categoryId]} />
        </Field>
        <Field data-invalid={!!errors.shortDescription}>
          <FieldLabel htmlFor={`${formId}-short`}>توضیح کوتاه</FieldLabel>
          <Input id={`${formId}-short`} {...form.register("shortDescription")} />
          <FieldError errors={[errors.shortDescription]} />
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor={`${formId}-desc`}>توضیحات کامل</FieldLabel>
          <Textarea id={`${formId}-desc`} rows={4} {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${formId}-icon`}>آیکون</FieldLabel>
            <NativeSelect id={`${formId}-icon`} className="w-full" dir="ltr" {...form.register("icon")}>
              <NativeSelectOption value="">—</NativeSelectOption>
              {SERVICE_ICON_NAMES.map((n) => (
                <NativeSelectOption key={n} value={n}>
                  {n}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.sortOrder}>
            <FieldLabel htmlFor={`${formId}-sort`}>ترتیب</FieldLabel>
            <Input id={`${formId}-sort`} type="number" min={0} dir="ltr" {...form.register("sortOrder")} />
            <FieldError errors={[errors.sortOrder]} />
          </Field>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Field orientation="horizontal" className="self-end pb-1">
                <Switch id={`${formId}-active`} checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor={`${formId}-active`}>فعال</FieldLabel>
              </Field>
            )}
          />
        </div>
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {serviceId ? "ذخیره تغییرات" : "ایجاد خدمت و رفتن به فرم‌ساز"}
        </Button>
      </FieldGroup>
    </form>
  );
}
