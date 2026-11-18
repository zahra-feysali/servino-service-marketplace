import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/features/avatars/rules";

const SIZES = {
  xs: "size-6 text-[0.65rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-24 text-2xl",
} as const;

/** Soft tinted backgrounds for the default avatar, picked deterministically from the name. */
const TONES = [
  "bg-primary/12 text-primary",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
];

function toneFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TONES[h % TONES.length];
}

/**
 * Profile picture with the default avatar (initials on a tinted background) as fallback —
 * shown while loading, when the user has no picture, or when the viewer may not see it.
 */
export function UserAvatar({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={`تصویر ${name}`} className="object-cover" /> : null}
      <AvatarFallback className={cn("font-semibold", toneFor(name))} aria-label={`تصویر پیش‌فرض ${name}`}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
