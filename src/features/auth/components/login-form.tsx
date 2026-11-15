"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    const result = await signIn("credentials", { ...values, redirect: false });
    if (!result || result.error) {
      setFormError(
        result?.error === "RATE_LIMITED"
          ? "تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر دوباره تلاش کنید."
          : "شماره موبایل/ایمیل یا رمز عبور اشتباه است، یا حساب شما غیرفعال است.",
      );
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {formError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={!!errors.identifier}>
          <FieldLabel htmlFor="identifier">شماره موبایل یا ایمیل</FieldLabel>
          <Input
            id="identifier"
            autoComplete="username"
            dir="ltr"
            className="text-left"
            placeholder="09121234567"
            aria-invalid={!!errors.identifier}
            {...form.register("identifier")}
          />
          <FieldError errors={[errors.identifier]} />
        </Field>

        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">رمز عبور</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className="text-left"
            aria-invalid={!!errors.password}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <LogIn />}
          ورود
        </Button>
      </FieldGroup>
    </form>
  );
}
