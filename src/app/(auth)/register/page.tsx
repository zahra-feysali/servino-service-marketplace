import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getCurrentUserSafe } from "@/features/auth/current-user-safe";
import { dashboardPathForRole } from "@/features/auth/rbac";

export const metadata: Metadata = { title: "ثبت‌نام" };

type Props = { searchParams: Promise<{ role?: string | string[] }> };

export default async function RegisterPage({ searchParams }: Props) {
  const user = await getCurrentUserSafe();
  if (user) redirect(dashboardPathForRole(user.role));

  const { role } = await searchParams;
  const initialRole = role === "provider" ? "PROVIDER" : "CUSTOMER";

  return (
    <Card className="w-full max-w-lg shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">ایجاد حساب کاربری</CardTitle>
        <CardDescription>به‌عنوان مشتری خدمات بگیرید یا به‌عنوان متخصص خدمات ارائه دهید.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm initialRole={initialRole} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        قبلاً ثبت‌نام کرده‌اید؟
        <Link href="/login" className="ms-1 font-medium text-primary hover:underline">
          وارد شوید
        </Link>
      </CardFooter>
    </Card>
  );
}
