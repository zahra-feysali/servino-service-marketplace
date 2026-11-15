/** Icon names admins may assign to categories/services (rendered by components/shared/service-icon). */
export const SERVICE_ICON_NAMES = [
  "sparkles",
  "wrench",
  "hammer",
  "droplets",
  "zap",
  "truck",
  "refrigerator",
  "washing-machine",
  "paintbrush",
  "brush",
  "bath",
  "plug",
  "laptop",
  "car",
] as const;
export type ServiceIconName = (typeof SERVICE_ICON_NAMES)[number];
