"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCategoryAction } from "@/features/catalog/admin-actions";
import { SERVICE_ICON_NAMES } from "@/features/catalog/icons";
import { categoryInputSchema, type CategoryInput } from "@/features/catalog/schemas";

type Props = {
  categoryId?: string;
  initial?: Partial<CategoryInput>;
  parentOptions: { id: string; name: string }[];
  trigger: React.ReactNode;
  title: string;
};

export function CategoryDialog({ categoryId, initial, parentOptions, trigger, title }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const defaults: CategoryInput = {
    name: "",
    slug: "",
    description: "",
    icon: "",
    parentId: "",
    isActive: true,
    sortOrder: 0,
    ...initial,
  };
  const form = useForm<CategoryInput>({ resolver: zodResolver(categoryInputSchema) as never, defaultValues: defaults });
  const { errors } = form.formState;

  function onSubmit() {
    const values = form.getValues();
    startTransition(async () => {
      const result = await saveCategoryAction(categoryId ?? null, values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [k, m] of Object.entries(result.fieldErrors ?? {})) if (m?.[0]) form.setError(k as Path<CategoryInput>, { message: m[0] });
        return;
      }
      toast.success(result.message);
      setOpen(false);
      if (!categoryId) form.reset(defaults);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>دسته‌بندی اصلی یا زیر‌دسته (حداکثر دو سطح).</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate id={`category-form-${categoryId ?? "new"}`}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="cat-name">نام</FieldLabel>
                <Input id="cat-name" {...form.register("name")} aria-invalid={!!errors.name} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.slug}>
                <FieldLabel htmlFor="cat-slug">نامک (انگلیسی)</FieldLabel>
                <Input id="cat-slug" dir="ltr" className="text-left" placeholder="home-services" {...form.register("slug")} aria-invalid={!!errors.slug} />
                <FieldError errors={[errors.slug]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="cat-desc">توضیحات</FieldLabel>
              <Textarea id="cat-desc" rows={2} {...form.register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.parentId}>
                <FieldLabel htmlFor="cat-parent">والد</FieldLabel>
                <NativeSelect id="cat-parent" className="w-full" {...form.register("parentId")}>
                  <NativeSelectOption value="">— دسته‌بندی اصلی —</NativeSelectOption>
                  {parentOptions
                    .filter((p) => p.id !== categoryId)
                    .map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
                <FieldError errors={[errors.parentId]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cat-icon">آیکون</FieldLabel>
                <NativeSelect id="cat-icon" className="w-full" dir="ltr" {...form.register("icon")}>
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {SERVICE_ICON_NAMES.map((n) => (
                    <NativeSelectOption key={n} value={n}>
                      {n}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field data-invalid={!!errors.sortOrder}>
                <FieldLabel htmlFor="cat-sort">ترتیب</FieldLabel>
                <Input id="cat-sort" type="number" min={0} dir="ltr" {...form.register("sortOrder")} />
                <FieldError errors={[errors.sortOrder]} />
              </Field>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="cat-active" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="cat-active">فعال (نمایش در سایت)</FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form={`category-form-${categoryId ?? "new"}`} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
