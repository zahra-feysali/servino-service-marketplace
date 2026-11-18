import type { Metadata } from "next";
import { WalletView } from "@/features/payments/components/wallet-view";
import { getWalletOverview } from "@/features/payments/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "کیف پول" };

export default async function CustomerWalletPage() {
  const user = await requireRolePage("CUSTOMER");
  return <WalletView overview={await getWalletOverview(user.id)} role="CUSTOMER" />;
}
