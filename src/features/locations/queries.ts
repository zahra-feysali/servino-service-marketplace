import { prisma } from "@/lib/prisma";

/** All provinces and cities (active and inactive) for admin screens and filters. */
export async function listAllCitiesGrouped() {
  return prisma.province.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      sortOrder: true,
      cities: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          sortOrder: true,
          _count: { select: { serviceAreas: true, addresses: true, requests: true } },
        },
      },
    },
  });
}
