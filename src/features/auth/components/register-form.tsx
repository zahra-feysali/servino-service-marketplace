"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Controller, useForm, useWatch, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Briefcase, Loader2, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { registerAction } from "@/features/auth/actions";
import { registerSchema, type RegisterInput, type RegisterRole } from "@/features/auth/schemas";
import { dashboardPathForRole } from "@/features/auth/rbac";

export function RegisterForm({ initialRole }: { initialRole: RegisterRole }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: initialRole,
      fullName: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
      acceptTerms: false as unknown as true,
    },
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: "role" });

  function onSubmit() {
    setFormError(null);
    // Send the raw input; the server re-validates and normalizes everything.
    const raw = form.getValues();
    startTransition(async () => {
      const result = await registerAction(raw);
      if (!result.ok) {
        setFormError(result.error);
        for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(key as Path<RegisterInput>, { message: messages[0] });
        }
        return;
      }

      toast.success(result.message ?? "ثبت‌نام انجام شد.");
      const login = await signIn("credentials", {
        identifier: raw.phone,
        password: raw.password,
        redirect: false,
      });
      if (!login || login.error) {
        router.push("/login");
        return;
      }
      router.replace(dashboardPathForRole(result.data.role));
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <Tabs value={field.value} onValueChange={(v) => field.onChange(v as RegisterRole)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="CUSTOMER">
                  <User />
                  مشتری هستم
                </TabsTrigger>
                <TabsTrigger value="PROVIDER">
                  <Briefcase />
                  متخصص هستم
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        />

        {formError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={!!errors.fullName}>
          <FieldLabel htmlFor="fullName">نام و نام خانوادگی</FieldLabel>
          <Input id="fullName" autoComplete="name" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
          <FieldError errors={[errors.fullName]} />
        </Field>

        {role === "PROVIDER" ? (
          <Field data-invalid={!!errors.displayName}>
            <FieldLabel htmlFor="displayName">نام نمایشی (اختیاری)</FieldLabel>
            <Input id="displayName" placeholder="مثلاً: خدمات فنی رضایی" {...form.register("displayName")} />
            <FieldDescription>این نام در پروفایل حرفه‌ای شما به مشتریان نمایش داده می‌شود.</FieldDescription>
            <FieldError errors={[errors.displayName]} />
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.phone}>
            <FieldLabel htmlFor="phone">شماره موبایل</FieldLabel>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              className="text-left"
              placeholder="09121234567"
              aria-invalid={!!errors.phone}
              {...form.register("phone")}
            />
            <FieldError errors={[errors.phone]} />
          </Field>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">ایمیل (اختیاری)</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              className="text-left"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">رمز عبور</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-left"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">تکرار رمز عبور</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-left"
              aria-invalid={!!errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
        </div>
        <FieldDescription>رمز عبور حداقل ۸ کاراکتر و شامل حرف و عدد باشد.</FieldDescription>

        <Controller
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <Field orientation="horizontal" data-invalid={!!errors.acceptTerms}>
              <Checkbox
                id="acceptTerms"
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={!!errors.acceptTerms}
              />
              <FieldLabel htmlFor="acceptTerms" className="font-normal">
                قوانین و مقررات استفاده از سروینو را می‌پذیرم.
              </FieldLabel>
            </Field>
          )}
        />
        <FieldError errors={[errors.acceptTerms]} />

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {role === "PROVIDER" ? "ثبت‌نام به‌عنوان متخصص" : "ثبت‌نام"}
        </Button>
      </FieldGroup>
    </form>
  );
}
