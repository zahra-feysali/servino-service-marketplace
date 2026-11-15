import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUserSafe } from "@/features/auth/current-user-safe";
import { isSafeRelativePath, resolvePostLoginRedirect } from "@/features/auth/rbac";

export const metadata: Metadata = { title: "ورود" };

type Props = { searchParams: Promise<{ callbackUrl?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;

  const user = await getCurrentUserSafe();
  if (user) redirect(resolvePostLoginRedirect(callbackUrl, user.role));

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">ورود به حساب کاربری</CardTitle>
        <CardDescription>با شماره موبایل یا ایمیل و رمز عبور خود وارد شوید.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm callbackUrl={isSafeRelativePath(callbackUrl) ? callbackUrl : "/dashboard"} />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        حساب کاربری ندارید؟
        <Link href="/register" className="ms-1 font-medium text-primary hover:underline">
          ثبت‌نام کنید
        </Link>
      </CardFooter>
    </Card>
  );
}
