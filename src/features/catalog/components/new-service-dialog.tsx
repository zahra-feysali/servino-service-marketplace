"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ServiceForm } from "./service-form";

export function NewServiceDialog({
  categoryOptions,
  defaultCategoryId,
  trigger,
}: {
  categoryOptions: { id: string; label: string }[];
  defaultCategoryId?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>خدمت جدید</DialogTitle>
          <DialogDescription>پس از ایجاد، فرم اختصاصی درخواست این خدمت را طراحی کنید.</DialogDescription>
        </DialogHeader>
        <ServiceForm
          formId={`new-service-${defaultCategoryId ?? "any"}`}
          categoryOptions={categoryOptions}
          initial={{ categoryId: defaultCategoryId ?? "" }}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
