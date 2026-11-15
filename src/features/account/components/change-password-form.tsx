"use client";

import { useTransition } from "react";
import { useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePasswordAction } from "@/features/account/actions";
import { changePasswordSchema, type ChangePasswordInput } from "@/features/auth/schemas";

const FIELDS: { name: keyof ChangePasswordInput; label: string; autoComplete: string }[] = [
  { name: "currentPassword", label: "رمز عبور فعلی", autoComplete: "current-password" },
  { name: "newPassword", label: "رمز عبور جدید", autoComplete: "new-password" },
  { name: "confirmPassword", label: "تکرار رمز عبور جدید", autoComplete: "new-password" },
];

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  function onSubmit() {
    const values = form.getValues();
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        toast.error(result.error);
        for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(key as Path<ChangePasswordInput>, { message: messages[0] });
        }
        return;
      }
      toast.success("رمز عبور تغییر کرد. برای امنیت بیشتر، همه نشست‌ها بسته شد؛ دوباره وارد شوید.");
      form.reset();
      await signOut({ callbackUrl: "/login" });
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {FIELDS.map((f) => (
          <Field key={f.name} data-invalid={!!errors[f.name]}>
            <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
            <Input
              id={f.name}
              type="password"
              dir="ltr"
              className="text-left"
              autoComplete={f.autoComplete}
              aria-invalid={!!errors[f.name]}
              {...form.register(f.name)}
            />
            <FieldError errors={[errors[f.name]]} />
          </Field>
        ))}
        <Button type="submit" disabled={pending} className="justify-self-start">
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          تغییر رمز عبور
        </Button>
      </FieldGroup>
    </form>
  );
}
