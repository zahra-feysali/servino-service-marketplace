import type { Metadata } from "next";
import { AccountSettings } from "@/features/account/components/account-settings";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تنظیمات حساب" };

export default async function SettingsPage() {
  const user = await requireRolePage("ADMIN");
  return <AccountSettings user={user} />;
}
