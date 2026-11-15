import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="مورد درخواستی یافت نشد"
      description="ممکن است حذف شده باشد یا دسترسی مشاهده آن را نداشته باشید."
      action={
        <Button asChild>
          <Link href="/dashboard/admin">بازگشت به پیشخوان</Link>
        </Button>
      }
    />
  );
}
