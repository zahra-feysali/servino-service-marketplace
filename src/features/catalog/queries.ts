import { prisma } from "@/lib/prisma";

/** Active main categories with their active subcategories and active services (public catalog). */
export async function getPublicCatalog() {
  return prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      services: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, shortDescription: true, icon: true },
      },
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          icon: true,
          services: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, slug: true, shortDescription: true, icon: true },
          },
        },
      },
    },
  });
}

export type PublicCatalog = Awaited<ReturnType<typeof getPublicCatalog>>;

export async function getPublicServiceBySlug(slug: string) {
  return prisma.service.findFirst({
    where: { slug, isActive: true, category: { isActive: true } },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      icon: true,
      category: {
        select: { name: true, slug: true, parent: { select: { name: true, slug: true } } },
      },
      _count: { select: { providerServices: { where: { provider: { verificationStatus: "APPROVED" } } } } },
    },
  });
}

/** Flattens a category (and its subcategories) into a single service list. */
export function servicesOfCategory(category: PublicCatalog[number]) {
  return [...category.services, ...category.children.flatMap((c) => c.services)];
}
