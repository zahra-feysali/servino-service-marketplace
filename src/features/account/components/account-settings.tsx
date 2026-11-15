import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ROLE_LABELS } from "@/features/auth/rbac";
import { getAccount } from "@/features/account/service";
import type { CurrentUser } from "@/lib/authz";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";

/** Shared account-settings page body for every role. Always operates on the signed-in user. */
export async function AccountSettings({ user }: { user: CurrentUser }) {
  const account = await getAccount(user.id);

  return (
    <>
      <PageHeader title="تنظیمات حساب" description="اطلاعات شخصی و رمز عبور خود را مدیریت کنید." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اطلاعات حساب</CardTitle>
            <CardDescription>
              نقش: {ROLE_LABELS[account.role]} — عضویت از {formatDate(account.createdAt)}
              {account.lastLoginAt ? <> — آخرین ورود: {formatDateTime(account.lastLoginAt)}</> : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm defaultValues={{ fullName: account.fullName, email: account.email ?? "" }} phone={account.phone} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">تغییر رمز عبور</CardTitle>
            <CardDescription>برای امنیت بیشتر از رمز عبور قوی و منحصربه‌فرد استفاده کنید.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
