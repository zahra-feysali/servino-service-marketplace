import type { Metadata } from "next";
import { ConversationPage } from "@/features/chat/components/conversation-page";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "گفتگو" };

export default async function ConversationRoute({ params }: PageProps<"/dashboard/customer/messages/[id]">) {
  const user = await requireRolePage("CUSTOMER");
  const { id } = await params;
  return <ConversationPage user={user} id={id} />;
}
