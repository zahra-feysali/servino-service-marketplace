"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_UPLOAD_MB, UPLOADABLE_MIME_TYPES, type FieldDefinition } from "@/features/forms/definitions";
import { buildAnswersSchema, defaultAnswers, fileRules, validateFieldFiles } from "@/features/forms/answers";
import { FILE_FIELD_PREFIX, GENERAL_ATTACHMENTS_FIELD, requestBaseSchema } from "@/features/requests/schemas";
import { DynamicField } from "./dynamic-field";

type Province = { id: string; name: string; cities: { id: string; name: string }[] };
type SavedAddress = { id: string; title: string; cityId: string; line: string; isDefault: boolean };
type FormValues = {
  addressId: string;
  cityId: string;
  addressText: string;
  preferredDate: string;
  description: string;
  answers: Record<string, unknown>;
};

const GENERAL_KEY = "__general";

export function RequestForm({
  serviceId,
  fields,
  provinces,
  addresses = [],
}: {
  serviceId: string;
  fields: FieldDefinition[];
  provinces: Province[];
  addresses?: SavedAddress[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string | undefined>>({});

  // Same validation rules as the server (shared Zod builders).
  const schema = useMemo(
    () => requestBaseSchema.omit({ serviceId: true }).extend({ answers: buildAnswersSchema(fields) }),
    [fields],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: { addressId: "", cityId: "", addressText: "", preferredDate: "", description: "", answers: defaultAnswers(fields) },
  });
  const { errors } = form.formState;
  const answerErrors = (errors.answers ?? {}) as Record<string, { message?: string } | undefined>;
  const fileFields = fields.filter((f) => f.type === "FILE");

  function validateFiles(): boolean {
    const next: Record<string, string | undefined> = {};
    for (const f of fileFields) next[f.name] = validateFieldFiles(f, files[f.name] ?? []) ?? undefined;
    next[GENERAL_KEY] = validateFieldFiles({ config: { maxFiles: 5 }, isRequired: false, label: "پیوست‌ها" }, files[GENERAL_KEY] ?? []) ?? undefined;
    setFileErrors(next);
    return Object.values(next).every((v) => !v);
  }

  function addFiles(key: string, list: FileList | null) {
    if (!list) return;
    setFiles((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), ...Array.from(list)] }));
    setFileErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function removeFile(key: string, index: number) {
    setFiles((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((_, i) => i !== index) }));
  }

  async function onSubmit() {
    setFormError(null);
    if (!validateFiles()) return;
    const raw = form.getValues();
    const body = new FormData();
    body.set(
      "data",
      JSON.stringify({
        base: { serviceId, addressId: raw.addressId, cityId: raw.cityId, addressText: raw.addressText, description: raw.description, preferredDate: raw.preferredDate },
        answers: raw.answers,
      }),
    );
    for (const [key, list] of Object.entries(files)) {
      for (const file of list) body.append(key === GENERAL_KEY ? GENERAL_ATTACHMENTS_FIELD : `${FILE_FIELD_PREFIX}${key}`, file);
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", { method: "POST", body });
      const result = (await res.json()) as
        | { ok: true; data: { requestId: string; matchedProviders: number }; message?: string }
        | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
      if (!result.ok) {
        setFormError(result.error);
        for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
          const message = messages?.[0];
          if (!message) continue;
          if (key in raw && key !== "answers") form.setError(key as keyof FormValues, { message });
          else if (fileFields.some((f) => f.name === key)) setFileErrors((p) => ({ ...p, [key]: message }));
          else if (key === "attachments") setFileErrors((p) => ({ ...p, [GENERAL_KEY]: message }));
          else form.setError(`answers.${key}` as never, { message });
        }
        return;
      }
      toast.success(result.message ?? "درخواست ثبت شد.");
      router.push(`/dashboard/customer/requests/${result.data.requestId}`);
      router.refresh();
    } catch {
      setFormError("ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  const fileInput = (key: string, title: string, rules: ReturnType<typeof fileRules>, help?: string | null, required?: boolean) => (
    <Field key={key} data-invalid={!!fileErrors[key]}>
      <FieldLabel htmlFor={`file-${key}`}>
        {title}
        {required ? <span className="text-destructive"> *</span> : null}
      </FieldLabel>
      <Input
        id={`file-${key}`}
        type="file"
        multiple={rules.maxFiles > 1}
        accept={rules.accept.join(",")}
        onChange={(e) => {
          addFiles(key, e.target.files);
          e.target.value = "";
        }}
      />
      <FieldDescription>
        {help ? `${help} — ` : ""}حداکثر {rules.maxFiles} فایل، هر فایل تا {Math.round(rules.maxBytes / 1024 / 1024)} مگابایت (
        {rules.accept.map((m) => m.split("/")[1].toUpperCase()).join("، ")})
      </FieldDescription>
      {(files[key] ?? []).length > 0 ? (
        <ul className="space-y-1">
          {(files[key] ?? []).map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
              <Paperclip className="size-4 text-muted-foreground" aria-hidden />
              <span className="truncate">{f.name}</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="حذف فایل" onClick={() => removeFile(key, i)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldError>{fileErrors[key]}</FieldError>
    </Field>
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit, () => validateFiles())} noValidate className="space-y-6">
      {formError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {fields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">جزئیات خدمت</CardTitle>
            <CardDescription>به این سؤال‌ها پاسخ دهید تا متخصصان پیشنهاد دقیق‌تری بدهند.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {fields.map((f) =>
                f.type === "FILE" ? (
                  fileInput(f.name, f.label, fileRules(f), f.helpText, f.isRequired)
                ) : (
                  <DynamicField key={f.id} field={f} control={form.control} error={answerErrors[f.name]} />
                ),
              )}
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">محل و زمان انجام کار</CardTitle>
          <CardDescription>نشانی کامل فقط برای متخصصی که انتخاب می‌کنید نمایش داده می‌شود.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {addresses.length > 0 ? (
              <Field>
                <FieldLabel htmlFor="savedAddress">انتخاب از نشانی‌های ذخیره‌شده</FieldLabel>
                <NativeSelect
                  id="savedAddress"
                  className="w-full"
                  defaultValue=""
                  onChange={(e) => {
                    const a = addresses.find((x) => x.id === e.target.value);
                    form.setValue("addressId", a?.id ?? "");
                    if (a) {
                      form.setValue("cityId", a.cityId, { shouldValidate: true });
                      form.setValue("addressText", a.line, { shouldValidate: true });
                    }
                  }}
                >
                  <NativeSelectOption value="">— نشانی جدید —</NativeSelectOption>
                  {addresses.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.title}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.cityId}>
                <FieldLabel htmlFor="cityId">
                  شهر <span className="text-destructive">*</span>
                </FieldLabel>
                <NativeSelect
                  id="cityId"
                  className="w-full"
                  aria-invalid={!!errors.cityId}
                  {...form.register("cityId", { onChange: () => form.setValue("addressId", "") })}
                >
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
                <FieldError errors={[errors.cityId]} />
              </Field>
              <Field data-invalid={!!errors.preferredDate}>
                <FieldLabel htmlFor="preferredDate">تاریخ ترجیحی (اختیاری)</FieldLabel>
                <Input id="preferredDate" type="date" dir="ltr" className="text-left" {...form.register("preferredDate")} />
                <FieldError errors={[errors.preferredDate]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.addressText}>
              <FieldLabel htmlFor="addressText">
                نشانی <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea id="addressText" rows={2} aria-invalid={!!errors.addressText} {...form.register("addressText")} />
              <FieldError errors={[errors.addressText]} />
            </Field>
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="description">توضیحات تکمیلی (اختیاری)</FieldLabel>
              <Textarea id="description" rows={3} {...form.register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
            {fileInput(
              GENERAL_KEY,
              "پیوست‌ها (اختیاری)",
              { accept: [...UPLOADABLE_MIME_TYPES], maxBytes: MAX_UPLOAD_MB * 1024 * 1024, maxFiles: 5 },
              "تصاویر یا مدارک مرتبط",
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="animate-spin" /> : <Send />}
        ثبت درخواست
      </Button>
    </form>
  );
}
