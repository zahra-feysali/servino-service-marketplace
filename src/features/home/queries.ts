import { prisma } from "@/lib/prisma";

/** Real platform numbers for the home page (no invented marketing figures). */
export async function getPublicStats() {
  const [providers, completedOrders, services, rating] = await Promise.all([
    prisma.providerProfile.count({ where: { verificationStatus: "APPROVED", user: { status: "ACTIVE" } } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.review.aggregate({ where: { status: "PUBLISHED" }, _avg: { rating: true }, _count: true }),
  ]);
  return { providers, completedOrders, services, avgRating: rating._avg.rating, reviewCount: rating._count };
}

/** Bundled category illustrations (public/images/categories) keyed by top-level category slug. */
export const CATEGORY_IMAGES: Record<string, { src: string; alt: string }> = {
  cleaning: { src: "/images/categories/cleaning.webp", alt: "نظافت منزل با وسایل حرفه‌ای" },
  "appliance-repair": { src: "/images/categories/appliance-repair.webp", alt: "تعمیر لوازم خانگی" },
  "building-services": { src: "/images/categories/building-services.webp", alt: "خدمات تأسیسات و لوله‌کشی ساختمان" },
  moving: { src: "/images/categories/moving.webp", alt: "کارتن‌های اسباب‌کشی" },
};
