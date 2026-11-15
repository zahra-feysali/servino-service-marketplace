import { prisma } from "@/lib/prisma";
import { toFieldDefinition } from "@/features/forms/definitions";

/** Full catalog for the admin panel (includes inactive items). */
export async function getAdminCatalog() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      icon: true,
      isActive: true,
      sortOrder: true,
      services: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: adminServiceSelect,
      },
      children: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          icon: true,
          isActive: true,
          sortOrder: true,
          parentId: true,
          services: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: adminServiceSelect },
        },
      },
    },
  });
}
export type AdminCatalog = Awaited<ReturnType<typeof getAdminCatalog>>;

const adminServiceSelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  sortOrder: true,
  _count: { select: { formFields: true, requests: true, providerServices: true } },
} as const;

/** Flat category list for <select> inputs (main categories first, then their subcategories). */
export async function getCategoryOptions() {
  const mains = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, children: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } } },
  });
  return mains.flatMap((m) => [
    { id: m.id, label: m.name, isMain: true },
    ...m.children.map((c) => ({ id: c.id, label: `${m.name} › ${c.name}`, isMain: false })),
  ]);
}

export async function getAdminService(id: string) {
  const service = await prisma.service.findUnique({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      icon: true,
      isActive: true,
      sortOrder: true,
      formVersion: true,
      category: { select: { name: true } },
      formFields: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      _count: { select: { requests: true, providerServices: true } },
    },
  });
  if (!service) return null;
  return {
    ...service,
    formFields: service.formFields.map((f) => ({ ...toFieldDefinition(f), isActive: f.isActive })),
  };
}
