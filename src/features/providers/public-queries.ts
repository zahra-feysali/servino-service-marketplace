import { prisma } from "@/lib/prisma";
import { getLiveFeatured } from "@/features/featured/service";
import { orderProviders, type Placement } from "@/features/featured/rules";

const publicProviderSelect = {
  id: true,
  userId: true,
  displayName: true,
  bio: true,
  yearsOfExperience: true,
  ratingAverage: true,
  ratingCount: true,
  completedOrdersCount: true,
  services: { take: 4, select: { service: { select: { name: true } } } },
  areas: { take: 4, select: { city: { select: { name: true } } } },
  user: { select: { avatarUpdatedAt: true } },
} as const;

/** Only APPROVED providers with ACTIVE accounts are ever public. */
const publicWhere = { verificationStatus: "APPROVED" as const, user: { status: "ACTIVE" as const } };

/**
 * Provider discovery with backend ordering: live featured providers for the placement
 * first, then by rating. Optional filters by service slug and city id.
 */
export async function listPublicProviders(filter: { serviceSlug?: string; cityId?: string; placement?: Placement; take?: number } = {}) {
  const placement = filter.placement ?? "SEARCH";
  const [providers, featured] = await Promise.all([
    prisma.providerProfile.findMany({
      where: {
        ...publicWhere,
        ...(filter.serviceSlug ? { services: { some: { service: { slug: filter.serviceSlug, isActive: true } } } } : {}),
        ...(filter.cityId ? { areas: { some: { cityId: filter.cityId } } } : {}),
      },
      take: 200,
      select: publicProviderSelect,
    }),
    getLiveFeatured(placement),
  ]);
  return orderProviders(providers, featured, placement, new Date()).slice(0, filter.take ?? 60);
}

/** Featured providers for a section (only live featured entries, backend-ordered). */
export async function listFeaturedProviders(placement: Placement, take = 6) {
  const featured = await getLiveFeatured(placement);
  if (featured.length === 0) return [];
  const providers = await prisma.providerProfile.findMany({
    where: { ...publicWhere, id: { in: featured.map((f) => f.providerId) } },
    select: publicProviderSelect,
  });
  return orderProviders(providers, featured, placement, new Date()).filter((p) => p.isFeatured).slice(0, take);
}

export async function getPublicProvider(id: string) {
  return prisma.providerProfile.findFirst({
    where: { id, ...publicWhere },
    select: {
      ...publicProviderSelect,
      services: { select: { service: { select: { name: true, slug: true, isActive: true } } } },
      areas: { select: { city: { select: { name: true } } } },
      skills: { select: { id: true, name: true } },
      portfolio: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, description: true, imageKey: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true, customer: { select: { fullName: true } }, order: { select: { service: { select: { name: true } } } } },
      },
    },
  });
}

export async function getProviderRatingSummary(providerId: string) {
  return prisma.providerProfile.findUnique({ where: { id: providerId }, select: { ratingAverage: true, ratingCount: true } });
}

/** Provider's received (published + hidden) reviews for their own dashboard. */
export async function listProviderReviews(providerId: string) {
  return prisma.review.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, rating: true, comment: true, status: true, createdAt: true, customer: { select: { id: true, fullName: true, avatarUpdatedAt: true } }, order: { select: { id: true, code: true, service: { select: { name: true } } } } },
  });
}
