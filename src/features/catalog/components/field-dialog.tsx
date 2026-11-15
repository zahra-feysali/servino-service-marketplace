"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { saveFieldAction } from "@/features/catalog/admin-actions";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  MAX_FILES_PER_FIELD,
  MAX_UPLOAD_MB,
  UPLOADABLE_MIME_TYPES,
  fieldInputSchema,
  hasOptions,
  type FieldDefinition,
  type FieldInput,
  type FieldType,
  type UploadableMime,
} from "@/features/forms/definitions";

type FormValues = {
  label: string;
  name: string;
  type: FieldType;
  isRequired: boolean;
  isActive: boolean;
  options: { value: string; label: string }[];
  defaultValue: string;
  helpText: string;
  placeholder: string;
  min: string;
  max: string;
  maxLength: string;
  accept: string[];
  maxSizeMb: string;
  maxFiles: string;
};

const MIME_LABELS: Record<(typeof UPLOADABLE_MIME_TYPES)[number], string> = {
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

function toValues(field?: FieldDefinition & { isActive: boolean }): FormValues {
  const dv = field?.defaultValue;
  return {
    label: field?.label ?? "",
    name: field?.name ?? "",
    type: field?.type ?? "TEXT",
    isRequired: field?.isRequired ?? false,
    isActive: field?.isActive ?? true,
    options: field?.options ?? [],
    defaultValue: dv === null || dv === undefined ? "" : Array.isArray(dv) ? dv.join(",") : String(dv),
    helpText: field?.helpText ?? "",
    placeholder: field?.placeholder ?? "",
    min: field?.config?.min?.toString() ?? "",
    max: field?.config?.max?.toString() ?? "",
    maxLength: field?.config?.maxLength?.toString() ?? "",
    accept: field?.config?.accept ?? [],
    maxSizeMb: field?.config?.maxSizeMb?.toString() ?? "",
    maxFiles: field?.config?.maxFiles?.toString() ?? "",
  };
}

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/** Converts the editor's string-based values into the typed FieldInput the server validates. */
function toInput(v: FormValues): FieldInput {
  let defaultValue: unknown = undefined;
  const d = v.defaultValue.trim();
  if (d !== "" && v.type !== "FILE") {
    if (v.type === "NUMBER") defaultValue = Number(d);
    else if (v.type === "BOOLEAN") defaultValue = d === "true";
    else if (v.type === "CHECKBOX") defaultValue = d.split(",").map((s) => s.trim()).filter(Boolean);
    else defaultValue = d;
  }
  return {
    label: v.label,
    name: v.name,
    type: v.type,
    isRequired: v.isRequired,
    isActive: v.isActive,
    options: hasOptions(v.type) ? v.options : undefined,
    defaultValue,
    helpText: v.helpText || undefined,
    placeholder: v.placeholder || undefined,
    config: {
      min: num(v.min),
      max: num(v.max),
      maxLength: num(v.maxLength),
      accept: v.accept.length ? (v.accept as UploadableMime[]) : undefined,
      maxSizeMb: num(v.maxSizeMb),
      maxFiles: num(v.maxFiles),
    },
  };
}

export function FieldDialog({
  serviceId,
  field,
  trigger,
}: {
  serviceId: string;
  field?: FieldDefinition & { isActive: boolean };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const form = useForm<FormValues>({ defaultValues: toValues(field) });
  const options = useFieldArray({ control: form.control, name: "options" });
  const type = useWatch({ control: form.control, name: "type" });
  const formId = `field-form-${field?.id ?? "new"}`;

  function onSubmit(values: FormValues) {
    const input = toInput(values);
    const parsed = fieldInputSchema.safeParse(input);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
      setErrors(Object.fromEntries(Object.entries(flat).map(([k, m]) => [k, m?.[0]])));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveFieldAction(serviceId, field?.id ?? null, input);
      if (!result.ok) {
        toast.error(result.error);
        setErrors(Object.fromEntries(Object.entries(result.fieldErrors ?? {}).map(([k, m]) => [k, m?.[0]])));
        return;
      }
      toast.success(result.message);
      setOpen(false);
      if (!field) form.reset(toValues());
      router.refresh();
    });
  }

  const err = (k: string) => (errors[k] ? [{ message: errors[k] }] : undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{field ? `ویرایش فیلد «${field.label}»` : "فیلد جدید"}</DialogTitle>
          <DialogDescription>
            تغییر فرم روی درخواست‌های ثبت‌شده قبلی اثری ندارد؛ هر درخواست نسخه فرم زمان ثبت را نگه می‌دارد.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.label}>
                <FieldLabel htmlFor={`${formId}-label`}>عنوان نمایشی</FieldLabel>
                <Input id={`${formId}-label`} {...form.register("label")} />
                <FieldError errors={err("label")} />
              </Field>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor={`${formId}-name`}>نام فنی</FieldLabel>
                <Input id={`${formId}-name`} dir="ltr" className="text-left" placeholder="area_m2" {...form.register("name")} />
                <FieldError errors={err("name")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={`${formId}-type`}>نوع فیلد</FieldLabel>
                <NativeSelect id={`${formId}-type`} className="w-full" {...form.register("type")}>
                  {FIELD_TYPES.map((t) => (
                    <NativeSelectOption key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Controller
                control={form.control}
                name="isRequired"
                render={({ field: f }) => (
                  <Field orientation="horizontal" className="self-end pb-1">
                    <Switch id={`${formId}-req`} checked={f.value} onCheckedChange={f.onChange} />
                    <FieldLabel htmlFor={`${formId}-req`}>الزامی</FieldLabel>
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="isActive"
                render={({ field: f }) => (
                  <Field orientation="horizontal" className="self-end pb-1">
                    <Switch id={`${formId}-act`} checked={f.value} onCheckedChange={f.onChange} />
                    <FieldLabel htmlFor={`${formId}-act`}>فعال</FieldLabel>
                  </Field>
                )}
              />
            </div>
            {type === "BOOLEAN" ? (
              <FieldDescription>برای فیلد بله/خیر، «الزامی» یعنی مشتری باید این گزینه را تأیید کند.</FieldDescription>
            ) : null}

            {hasOptions(type) ? (
              <FieldSet>
                <FieldLegend variant="label">گزینه‌ها</FieldLegend>
                <div className="space-y-2">
                  {options.fields.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <Input placeholder="عنوان" {...form.register(`options.${i}.label`)} />
                      <Input placeholder="value" dir="ltr" className="w-36 text-left" {...form.register(`options.${i}.value`)} />
                      <Button type="button" variant="ghost" size="icon" aria-label="حذف گزینه" onClick={() => options.remove(i)}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => options.append({ label: "", value: `option_${options.fields.length + 1}` })}>
                    <Plus />
                    افزودن گزینه
                  </Button>
                </div>
                <FieldError errors={err("options")} />
              </FieldSet>
            ) : null}

            {type !== "FILE" ? (
              <Field data-invalid={!!errors.defaultValue}>
                <FieldLabel htmlFor={`${formId}-default`}>مقدار پیش‌فرض (اختیاری)</FieldLabel>
                {type === "BOOLEAN" ? (
                  <NativeSelect id={`${formId}-default`} className="w-full" {...form.register("defaultValue")}>
                    <NativeSelectOption value="">—</NativeSelectOption>
                    <NativeSelectOption value="true">بله</NativeSelectOption>
                    <NativeSelectOption value="false">خیر</NativeSelectOption>
                  </NativeSelect>
                ) : (
                  <Input
                    id={`${formId}-default`}
                    dir={type === "NUMBER" || type === "DATE" || hasOptions(type) ? "ltr" : undefined}
                    type={type === "DATE" ? "date" : type === "NUMBER" ? "number" : "text"}
                    {...form.register("defaultValue")}
                  />
                )}
                {hasOptions(type) ? (
                  <FieldDescription>مقدار (value) گزینه؛ برای انتخاب چندتایی با کاما جدا کنید.</FieldDescription>
                ) : null}
                <FieldError errors={err("defaultValue")} />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${formId}-help`}>متن راهنما</FieldLabel>
                <Input id={`${formId}-help`} {...form.register("helpText")} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${formId}-ph`}>متن جایگزین (placeholder)</FieldLabel>
                <Input id={`${formId}-ph`} {...form.register("placeholder")} />
              </Field>
            </div>

            {type === "NUMBER" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`${formId}-min`}>حداقل</FieldLabel>
                  <Input id={`${formId}-min`} type="number" dir="ltr" {...form.register("min")} />
                </Field>
                <Field data-invalid={!!errors.config}>
                  <FieldLabel htmlFor={`${formId}-max`}>حداکثر</FieldLabel>
                  <Input id={`${formId}-max`} type="number" dir="ltr" {...form.register("max")} />
                  <FieldError errors={err("config")} />
                </Field>
              </div>
            ) : null}
            {type === "TEXT" || type === "TEXTAREA" ? (
              <Field>
                <FieldLabel htmlFor={`${formId}-maxlen`}>حداکثر طول متن</FieldLabel>
                <Input id={`${formId}-maxlen`} type="number" dir="ltr" min={1} {...form.register("maxLength")} />
              </Field>
            ) : null}
            {type === "FILE" ? (
              <FieldSet>
                <FieldLegend variant="label">تنظیمات فایل</FieldLegend>
                <Controller
                  control={form.control}
                  name="accept"
                  render={({ field: f }) => (
                    <div className="flex flex-wrap gap-4">
                      {UPLOADABLE_MIME_TYPES.map((m) => (
                        <Field key={m} orientation="horizontal" className="w-auto">
                          <Checkbox
                            id={`${formId}-${m}`}
                            checked={f.value.includes(m)}
                            onCheckedChange={(c) => f.onChange(c ? [...f.value, m] : f.value.filter((x) => x !== m))}
                          />
                          <FieldLabel htmlFor={`${formId}-${m}`}>{MIME_LABELS[m]}</FieldLabel>
                        </Field>
                      ))}
                    </div>
                  )}
                />
                <FieldDescription>اگر هیچ نوعی انتخاب نشود، همه نوع‌های مجاز پذیرفته می‌شوند.</FieldDescription>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${formId}-size`}>حداکثر حجم (مگابایت، تا {MAX_UPLOAD_MB})</FieldLabel>
                    <Input id={`${formId}-size`} type="number" dir="ltr" step="0.5" {...form.register("maxSizeMb")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${formId}-files`}>حداکثر تعداد فایل (تا {MAX_FILES_PER_FIELD})</FieldLabel>
                    <Input id={`${formId}-files`} type="number" dir="ltr" {...form.register("maxFiles")} />
                  </Field>
                </div>
                <FieldError errors={err("config")} />
              </FieldSet>
            ) : null}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="submit" form={formId} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            ذخیره فیلد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
