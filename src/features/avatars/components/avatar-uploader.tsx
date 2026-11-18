"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { removeAvatarAction } from "@/features/account/actions";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/features/avatars/rules";
import { postFormData } from "@/lib/upload-client";
import { toPersianDigits } from "@/lib/utils";

const OUTPUT_SIZE = 512;

/** Center-crops the image to a square and resizes it to 512 px (WebP, JPEG fallback). */
async function normalizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(OUTPUT_SIZE, side);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  const blob = (await toBlob("image/webp")) ?? (await toBlob("image/jpeg"));
  // Some browsers silently fall back to PNG for unsupported types; keep whichever is smaller.
  return blob && blob.size < file.size ? blob : file;
}

/** Upload / change / delete the signed-in user's profile picture. */
export function AvatarUploader({ name, src }: { name: string; src: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const busy = progress !== null || removing;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!picked) return;
    setError(null);
    if (!AVATAR_MIME_TYPES.includes(picked.type as (typeof AVATAR_MIME_TYPES)[number])) {
      setError("فقط تصویر JPG، PNG یا WebP مجاز است.");
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      setError("حجم تصویر بیش از حد مجاز است.");
      return;
    }
    let blob: Blob = picked;
    try {
      blob = await normalizeImage(picked);
    } catch {
      // Keep the original file; the server validates it anyway.
    }
    if (blob.size > AVATAR_MAX_BYTES) {
      setError("حجم تصویر پس از فشرده‌سازی هنوز بیش از ۲ مگابایت است.");
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    const body = new FormData();
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    body.set("avatar", blob, `avatar.${ext}`);
    setProgress(0);
    const result = await postFormData("/api/avatars", body, setProgress);
    setProgress(null);
    if (!result.ok) {
      setError(result.error);
      setPreview(null);
      URL.revokeObjectURL(url);
      return;
    }
    toast.success(result.message ?? "تصویر پروفایل به‌روزرسانی شد.");
    router.refresh();
  }

  function onRemove() {
    startRemove(async () => {
      const r = await removeAvatarAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setPreview(null);
      toast.success(r.message ?? "تصویر حذف شد.");
      router.refresh();
    });
  }

  const shown = preview ?? src;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <UserAvatar name={name} src={shown} size="xl" className="ring-4 ring-background shadow-soft" />
        {progress !== null ? (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-background/70 text-xs font-semibold">
            {toPersianDigits(progress)}٪
          </div>
        ) : null}
      </div>
      <div className="space-y-2 text-center sm:text-start">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {progress !== null ? <Loader2 className="animate-spin" /> : <Camera />}
            {shown ? "تغییر تصویر" : "بارگذاری تصویر"}
          </Button>
          {src ? (
            <Button type="button" size="sm" variant="outline" onClick={onRemove} disabled={busy}>
              {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              حذف تصویر
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">JPG، PNG یا WebP — تصویر به‌صورت مربعی برش داده و فشرده می‌شود (حداکثر ۲ مگابایت).</p>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <input ref={inputRef} type="file" accept={AVATAR_MIME_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
      </div>
    </div>
  );
}
