import Link from "next/link";
import { CheckCircle2, Circle, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { submitForVerificationAction } from "@/features/providers/actions";
import { VERIFICATION_STATUS_META } from "@/features/providers/labels";
import { CHECKLIST_LABELS, verificationChecklist, type ProfileCompleteness, type VerificationStatus } from "@/features/providers/verification";

const LINKS = {
  bio: "/dashboard/provider/profile",
  services: "/dashboard/provider/services",
  areas: "/dashboard/provider/services",
  documents: "/dashboard/provider/documents",
} as const;

export function ProfileChecklist({ status, completeness, rejectionReason }: { status: VerificationStatus; completeness: ProfileCompleteness; rejectionReason: string | null }) {
  const items = verificationChecklist(completeness);
  const allDone = items.every((i) => i.done);
  const canSubmit = (status === "DRAFT" || status === "REJECTED") && allDone;
  const meta = VERIFICATION_STATUS_META[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">وضعیت تأیید حساب: {meta.label}</CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "REJECTED" && rejectionReason ? (
          <Alert variant="destructive">
            <AlertTitle>دلیل رد</AlertTitle>
            <AlertDescription>{rejectionReason}</AlertDescription>
          </Alert>
        ) : null}
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-sm">
              {i.done ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
              <Link href={LINKS[i.key]} className={i.done ? "text-muted-foreground" : "hover:text-primary"}>
                {CHECKLIST_LABELS[i.key]}
              </Link>
            </li>
          ))}
        </ul>
        {status === "DRAFT" || status === "REJECTED" ? (
          canSubmit ? (
            <ActionButton
              action={submitForVerificationAction}
              confirm={{ title: "ارسال پروفایل برای بررسی؟", description: "پس از ارسال، مدیر اطلاعات و مدارک شما را بررسی می‌کند.", confirmLabel: "ارسال" }}
            >
              <Send />
              ارسال برای تأیید
            </ActionButton>
          ) : (
            <p className="text-sm text-muted-foreground">برای ارسال درخواست تأیید، همه موارد بالا را تکمیل کنید.</p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
