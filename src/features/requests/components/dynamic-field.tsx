"use client";

import { Controller, type Control, type FieldError as RhfFieldError, type FieldValues, type Path } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { JalaliHint } from "@/components/shared/jalali-hint";
import type { FieldDefinition } from "@/features/forms/definitions";

/** Renders one dynamic (admin-defined) field, except FILE fields which the form handles itself. */
export function DynamicField<T extends FieldValues>({
  field,
  control,
  error,
}: {
  field: FieldDefinition;
  control: Control<T>;
  error?: RhfFieldError | { message?: string };
}) {
  const id = `answer-${field.name}`;
  // Dynamic field names are only known at runtime; values live under `answers.<name>`.
  const name = `answers.${field.name}` as Path<T>;
  const label = (
    <>
      {field.label}
      {field.isRequired ? <span className="text-destructive"> *</span> : null}
    </>
  );
  const help = field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null;
  const err = <FieldError errors={error ? [error] : undefined} />;
  const options = field.options ?? [];

  switch (field.type) {
    case "TEXT":
    case "TEXTAREA":
    case "NUMBER":
    case "DATE":
      return (
        <Controller
          control={control}
          name={name}
          render={({ field: f }) => (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              {field.type === "TEXTAREA" ? (
                <Textarea id={id} rows={3} placeholder={field.placeholder ?? undefined} aria-invalid={!!error} {...f} value={(f.value as string) ?? ""} />
              ) : (
                <Input
                  id={id}
                  type={field.type === "NUMBER" ? "number" : field.type === "DATE" ? "date" : "text"}
                  inputMode={field.type === "NUMBER" ? "decimal" : undefined}
                  dir={field.type === "NUMBER" || field.type === "DATE" ? "ltr" : undefined}
                  className={field.type === "NUMBER" || field.type === "DATE" ? "text-left" : undefined}
                  min={field.type === "NUMBER" ? field.config?.min : undefined}
                  max={field.type === "NUMBER" ? field.config?.max : undefined}
                  placeholder={field.placeholder ?? undefined}
                  aria-invalid={!!error}
                  {...f}
                  value={f.value === undefined || f.value === null ? "" : String(f.value)}
                />
              )}
              {field.type === "DATE" ? <JalaliHint value={f.value} /> : null}
              {help}
              {err}
            </Field>
          )}
        />
      );

    case "SELECT":
      return (
        <Controller
          control={control}
          name={name}
          render={({ field: f }) => (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
              <NativeSelect id={id} className="w-full" aria-invalid={!!error} {...f} value={(f.value as string) ?? ""}>
                <NativeSelectOption value="">{field.placeholder || "انتخاب کنید…"}</NativeSelectOption>
                {options.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {help}
              {err}
            </Field>
          )}
        />
      );

    case "RADIO":
      return (
        <Controller
          control={control}
          name={name}
          render={({ field: f }) => (
            <FieldSet data-invalid={!!error}>
              <FieldLegend variant="label">{label}</FieldLegend>
              <RadioGroup dir="rtl" value={(f.value as string) ?? ""} onValueChange={f.onChange} className="flex flex-wrap gap-4">
                {options.map((o) => (
                  <Field key={o.value} orientation="horizontal" className="w-auto">
                    <RadioGroupItem id={`${id}-${o.value}`} value={o.value} aria-invalid={!!error} />
                    <FieldLabel htmlFor={`${id}-${o.value}`} className="font-normal">
                      {o.label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {help}
              {err}
            </FieldSet>
          )}
        />
      );

    case "CHECKBOX":
      return (
        <Controller
          control={control}
          name={name}
          render={({ field: f }) => {
            const value: string[] = Array.isArray(f.value) ? f.value : [];
            return (
              <FieldSet data-invalid={!!error}>
                <FieldLegend variant="label">{label}</FieldLegend>
                <div className="flex flex-wrap gap-4">
                  {options.map((o) => (
                    <Field key={o.value} orientation="horizontal" className="w-auto">
                      <Checkbox
                        id={`${id}-${o.value}`}
                        checked={value.includes(o.value)}
                        onCheckedChange={(c) => f.onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))}
                      />
                      <FieldLabel htmlFor={`${id}-${o.value}`} className="font-normal">
                        {o.label}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
                {help}
                {err}
              </FieldSet>
            );
          }}
        />
      );

    case "BOOLEAN":
      return (
        <Controller
          control={control}
          name={name}
          render={({ field: f }) => (
            <Field orientation="horizontal" data-invalid={!!error}>
              <Checkbox id={id} checked={f.value === true} onCheckedChange={(c) => f.onChange(c === true)} aria-invalid={!!error} />
              <div className="space-y-1">
                <FieldLabel htmlFor={id} className="font-normal">
                  {label}
                </FieldLabel>
                {help}
                {err}
              </div>
            </Field>
          )}
        />
      );

    case "FILE":
      return null;
  }
}
