import type { Metadata } from "next";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "اعلان‌ها" };

export default async function NotificationsPage() {
  const user = await requireRolePage("ADMIN");
  return <NotificationList userId={user.id} />;
}
