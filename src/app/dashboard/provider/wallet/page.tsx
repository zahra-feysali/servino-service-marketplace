import type { Metadata } from "next";
import { WalletView } from "@/features/payments/components/wallet-view";
import { getWalletOverview } from "@/features/payments/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "کیف پول و پرداخت‌ها" };

export default async function ProviderWalletPage() {
  const user = await requireRolePage("PROVIDER");
  return <WalletView overview={await getWalletOverview(user.id)} role="PROVIDER" />;
}
