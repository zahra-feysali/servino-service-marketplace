import {
  Bath,
  Brush,
  Car,
  Droplets,
  Hammer,
  Laptop,
  Paintbrush,
  Plug,
  Refrigerator,
  Sparkles,
  Truck,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Whitelisted Lucide icons that admins can reference by name on categories/services.
 * Unknown names fall back to a generic icon (no dynamic imports from user input).
 */
export const SERVICE_ICONS: Record<string, LucideIcon> = {
  bath: Bath,
  brush: Brush,
  car: Car,
  droplets: Droplets,
  hammer: Hammer,
  laptop: Laptop,
  paintbrush: Paintbrush,
  plug: Plug,
  refrigerator: Refrigerator,
  sparkles: Sparkles,
  truck: Truck,
  "washing-machine": WashingMachine,
  wrench: Wrench,
  zap: Zap,
};

export function ServiceIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && SERVICE_ICONS[name]) || Wrench;
  return <Icon className={className} aria-hidden />;
}
