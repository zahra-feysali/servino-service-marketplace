import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ConversationList } from "@/features/chat/components/conversation-list";
import { listConversations } from "@/features/chat/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "پیام‌ها" };

export default async function MessagesPage() {
  const user = await requireRolePage("PROVIDER");
  const items = await listConversations(user);
  return (
    <>
      <PageHeader icon={MessagesSquare} title="پیام‌ها" description="گفتگوهای شما درباره درخواست‌ها و سفارش‌ها" />
      <ConversationList items={items} emptyHint="پس از ارسال پیشنهاد برای یک درخواست، می‌توانید از صفحه همان درخواست با مشتری گفتگو کنید." />
    </>
  );
}
