import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ConversationList } from "@/features/chat/components/conversation-list";
import { listConversations } from "@/features/chat/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "پیام‌ها" };

export default async function MessagesPage() {
  const user = await requireRolePage("CUSTOMER");
  const items = await listConversations(user);
  return (
    <>
      <PageHeader icon={MessagesSquare} title="پیام‌ها" description="گفتگوهای شما درباره درخواست‌ها و سفارش‌ها" />
      <ConversationList items={items} emptyHint="پس از دریافت پیشنهاد از متخصصان، می‌توانید از صفحه درخواست یا سفارش با آن‌ها گفتگو کنید." />
    </>
  );
}
