/**
 * Development seed — idempotent (safe to run multiple times).
 * Run with: npx prisma db seed   (requires a running PostgreSQL + DATABASE_URL)
 *
 * Demo account passwords are for LOCAL DEVELOPMENT ONLY and can be overridden with
 * SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD. Never run this seed against production.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type FormFieldType, type Prisma } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the development seed with NODE_ENV=production.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Demo12345";

// ── Locations ────────────────────────────────────────────────────────────────
const PROVINCES = [
  { name: "تهران", slug: "tehran-province", cities: [{ name: "تهران", slug: "tehran" }, { name: "شهریار", slug: "shahriar" }] },
  { name: "البرز", slug: "alborz-province", cities: [{ name: "کرج", slug: "karaj" }] },
  { name: "اصفهان", slug: "isfahan-province", cities: [{ name: "اصفهان", slug: "isfahan" }, { name: "کاشان", slug: "kashan" }] },
  { name: "فارس", slug: "fars-province", cities: [{ name: "شیراز", slug: "shiraz" }] },
  { name: "خراسان رضوی", slug: "khorasan-razavi-province", cities: [{ name: "مشهد", slug: "mashhad" }] },
];

// ── Catalog ──────────────────────────────────────────────────────────────────
type SeedField = {
  name: string;
  label: string;
  type: FormFieldType;
  isRequired?: boolean;
  options?: { value: string; label: string }[];
  helpText?: string;
  config?: Prisma.InputJsonObject;
};
type SeedService = { name: string; slug: string; icon: string; shortDescription: string; description: string; fields: SeedField[] };
type SeedCategory = { name: string; slug: string; icon: string; description: string; children?: { name: string; slug: string; icon: string; services: SeedService[] }[]; services?: SeedService[] };

const CATALOG: SeedCategory[] = [
  {
    name: "نظافت و بهداشت",
    slug: "cleaning",
    icon: "sparkles",
    description: "نظافت منزل، محل کار و شست‌وشوی مبلمان و فرش",
    services: [
      {
        name: "نظافت منزل",
        slug: "home-cleaning",
        icon: "sparkles",
        shortDescription: "نظافت کامل یا بخشی از منزل توسط نیروهای مجرب",
        description: "نظافت آشپزخانه، سرویس‌ها، گردگیری و جاروکشی. مواد شوینده به انتخاب شما تأمین می‌شود.",
        fields: [
          { name: "area_m2", label: "متراژ تقریبی منزل (متر مربع)", type: "NUMBER", isRequired: true, config: { min: 20, max: 2000 } },
          { name: "rooms", label: "تعداد اتاق‌ها", type: "SELECT", isRequired: true, options: [
            { value: "1", label: "یک خوابه" }, { value: "2", label: "دو خوابه" }, { value: "3", label: "سه خوابه" }, { value: "4+", label: "چهار خوابه و بیشتر" },
          ] },
          { name: "parts", label: "بخش‌های مورد نظر", type: "CHECKBOX", options: [
            { value: "kitchen", label: "آشپزخانه" }, { value: "bathroom", label: "سرویس‌ها" }, { value: "windows", label: "شیشه‌ها" }, { value: "balcony", label: "بالکن" },
          ] },
          { name: "supplies_provided", label: "مواد شوینده توسط متخصص تأمین شود", type: "BOOLEAN" },
          { name: "preferred_date", label: "تاریخ ترجیحی", type: "DATE", isRequired: true },
        ],
      },
      {
        name: "شست‌وشوی مبل و فرش",
        slug: "sofa-carpet-cleaning",
        icon: "droplets",
        shortDescription: "شست‌وشوی مبلمان و فرش در محل",
        description: "شست‌وشوی تخصصی مبل پارچه‌ای، چرمی و فرش با دستگاه در محل.",
        fields: [
          { name: "item_type", label: "نوع", type: "RADIO", isRequired: true, options: [
            { value: "sofa", label: "مبلمان" }, { value: "carpet", label: "فرش" }, { value: "both", label: "هر دو" },
          ] },
          { name: "seats", label: "تعداد نفرات مبل", type: "NUMBER", config: { min: 1, max: 30 } },
          { name: "photo", label: "تصویر مبلمان یا فرش", type: "FILE", config: { accept: ["image/jpeg", "image/png", "image/webp"], maxSizeMb: 5 } },
        ],
      },
    ],
  },
  {
    name: "تعمیرات لوازم خانگی",
    slug: "appliance-repair",
    icon: "wrench",
    description: "تعمیر یخچال، لباسشویی، ظرفشویی و سایر لوازم خانگی",
    children: [
      {
        name: "لوازم سرمایشی",
        slug: "cooling-appliances",
        icon: "refrigerator",
        services: [
          {
            name: "تعمیر یخچال و فریزر",
            slug: "refrigerator-repair",
            icon: "refrigerator",
            shortDescription: "عیب‌یابی و تعمیر انواع یخچال و فریزر در محل",
            description: "شارژ گاز، تعویض کمپرسور، رفع برفک و سایر تعمیرات یخچال‌های ایرانی و خارجی.",
            fields: [
              { name: "brand", label: "برند دستگاه", type: "TEXT", isRequired: true, helpText: "مثلاً: اسنوا، ال‌جی، سامسونگ" },
              { name: "problem", label: "شرح مشکل", type: "TEXTAREA", isRequired: true },
              { name: "under_warranty", label: "دستگاه گارانتی دارد", type: "BOOLEAN" },
            ],
          },
        ],
      },
      {
        name: "لوازم شست‌وشو",
        slug: "washing-appliances",
        icon: "washing-machine",
        services: [
          {
            name: "تعمیر ماشین لباسشویی",
            slug: "washing-machine-repair",
            icon: "washing-machine",
            shortDescription: "تعمیر انواع لباسشویی در محل",
            description: "رفع نشتی، تعویض برد، پمپ تخلیه و بلبرینگ لباسشویی.",
            fields: [
              { name: "brand", label: "برند دستگاه", type: "TEXT", isRequired: true },
              { name: "capacity_kg", label: "ظرفیت (کیلوگرم)", type: "NUMBER", config: { min: 3, max: 20 } },
              { name: "problem", label: "شرح مشکل", type: "TEXTAREA", isRequired: true },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "تأسیسات ساختمان",
    slug: "building-services",
    icon: "hammer",
    description: "لوله‌کشی، برق‌کاری و خدمات فنی ساختمان",
    services: [
      {
        name: "لوله‌کشی و رفع نشتی",
        slug: "plumbing",
        icon: "droplets",
        shortDescription: "رفع نشتی، تعویض شیرآلات و لوله‌کشی",
        description: "تشخیص و رفع نشتی آب، باز کردن گرفتگی، تعویض شیرآلات و نصب لوازم بهداشتی.",
        fields: [
          { name: "issue", label: "نوع مشکل", type: "SELECT", isRequired: true, options: [
            { value: "leak", label: "نشتی" }, { value: "clog", label: "گرفتگی" }, { value: "install", label: "نصب شیرآلات" }, { value: "other", label: "سایر" },
          ] },
          { name: "urgent", label: "فوری است", type: "BOOLEAN" },
          { name: "details", label: "توضیحات", type: "TEXTAREA" },
        ],
      },
      {
        name: "برق‌کاری ساختمان",
        slug: "electrical",
        icon: "zap",
        shortDescription: "سیم‌کشی، تعویض کلید و پریز و رفع اتصالی",
        description: "رفع اتصالی، نصب لوستر، سیم‌کشی و تعویض فیوز و کلید و پریز.",
        fields: [
          { name: "task", label: "نوع کار", type: "RADIO", isRequired: true, options: [
            { value: "fix", label: "رفع خرابی" }, { value: "install", label: "نصب" }, { value: "wiring", label: "سیم‌کشی" },
          ] },
          { name: "details", label: "توضیحات", type: "TEXTAREA", isRequired: true },
        ],
      },
    ],
  },
  {
    name: "اسباب‌کشی و حمل‌ونقل",
    slug: "moving",
    icon: "truck",
    description: "اسباب‌کشی منزل و محل کار با کارگر و خودرو",
    services: [
      {
        name: "اسباب‌کشی منزل",
        slug: "home-moving",
        icon: "truck",
        shortDescription: "بسته‌بندی و حمل اثاثیه منزل",
        description: "بسته‌بندی، حمل و چیدمان اثاثیه با خودروی مناسب و کارگر مجرب.",
        fields: [
          { name: "origin_floor", label: "طبقه مبدأ", type: "NUMBER", isRequired: true, config: { min: -3, max: 50 } },
          { name: "destination_floor", label: "طبقه مقصد", type: "NUMBER", isRequired: true, config: { min: -3, max: 50 } },
          { name: "has_elevator", label: "آسانسور دارد", type: "BOOLEAN" },
          { name: "packing", label: "بسته‌بندی توسط متخصص انجام شود", type: "BOOLEAN" },
          { name: "move_date", label: "تاریخ اسباب‌کشی", type: "DATE", isRequired: true },
        ],
      },
    ],
  },
];

// ── Subscription plans ────────────────────────────────────────────────────────
const PLANS = [
  { slug: "basic", name: "پایه", price: 290_000, durationDays: 30, maxRequestsPerPeriod: 20, maxOffersPerPeriod: 15, sortOrder: 1,
    description: "مناسب برای شروع کار در سروینو", features: ["دریافت تا ۲۰ درخواست در ماه", "ارسال تا ۱۵ پیشنهاد", "نمایش پروفایل در جستجو"] },
  { slug: "pro", name: "حرفه‌ای", price: 690_000, durationDays: 30, maxRequestsPerPeriod: 80, maxOffersPerPeriod: 60, sortOrder: 2,
    description: "برای متخصصان فعال با حجم کار بالا", features: ["دریافت تا ۸۰ درخواست در ماه", "ارسال تا ۶۰ پیشنهاد", "پشتیبانی اولویت‌دار"] },
  { slug: "unlimited-quarterly", name: "نامحدود سه‌ماهه", price: 1_790_000, durationDays: 90, maxRequestsPerPeriod: null, maxOffersPerPeriod: null, sortOrder: 3,
    description: "بدون محدودیت دریافت درخواست به مدت سه ماه", features: ["دریافت نامحدود درخواست", "ارسال نامحدود پیشنهاد", "پشتیبانی اولویت‌دار"] },
];

async function upsertUser(params: { fullName: string; phone: string; email: string; role: "ADMIN" | "CUSTOMER" | "PROVIDER"; password: string }) {
  const passwordHash = await bcrypt.hash(params.password, 12);
  const user = await prisma.user.upsert({
    where: { phone: params.phone },
    update: { fullName: params.fullName, email: params.email, role: params.role, status: "ACTIVE" },
    create: { fullName: params.fullName, phone: params.phone, email: params.email, role: params.role, passwordHash, status: "ACTIVE" },
  });
  await prisma.wallet.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
  return user;
}

async function main() {
  console.log("Seeding locations…");
  const cityIds = new Map<string, string>();
  for (const [pi, p] of PROVINCES.entries()) {
    const province = await prisma.province.upsert({
      where: { slug: p.slug },
      update: { name: p.name, sortOrder: pi },
      create: { name: p.name, slug: p.slug, sortOrder: pi },
    });
    for (const [ci, c] of p.cities.entries()) {
      const city = await prisma.city.upsert({
        where: { slug: c.slug },
        update: { name: c.name, provinceId: province.id, sortOrder: ci },
        create: { name: c.name, slug: c.slug, provinceId: province.id, sortOrder: ci },
      });
      cityIds.set(c.slug, city.id);
    }
  }

  console.log("Seeding catalog…");
  const serviceIds = new Map<string, string>();
  const upsertService = async (categoryId: string, s: SeedService, sortOrder: number) => {
    const service = await prisma.service.upsert({
      where: { slug: s.slug },
      update: { name: s.name, icon: s.icon, shortDescription: s.shortDescription, description: s.description, categoryId, sortOrder },
      create: { name: s.name, slug: s.slug, icon: s.icon, shortDescription: s.shortDescription, description: s.description, categoryId, sortOrder },
    });
    serviceIds.set(s.slug, service.id);
    for (const [fi, f] of s.fields.entries()) {
      const data = {
        label: f.label,
        type: f.type,
        isRequired: f.isRequired ?? false,
        options: f.options ?? undefined,
        helpText: f.helpText ?? null,
        config: f.config ?? undefined,
        sortOrder: fi,
      };
      await prisma.serviceFormField.upsert({
        where: { serviceId_name: { serviceId: service.id, name: f.name } },
        update: data,
        create: { ...data, serviceId: service.id, name: f.name },
      });
    }
  };

  for (const [i, c] of CATALOG.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, icon: c.icon, description: c.description, sortOrder: i, parentId: null },
      create: { name: c.name, slug: c.slug, icon: c.icon, description: c.description, sortOrder: i },
    });
    for (const [si, s] of (c.services ?? []).entries()) await upsertService(category.id, s, si);
    for (const [ci, child] of (c.children ?? []).entries()) {
      const sub = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, icon: child.icon, parentId: category.id, sortOrder: ci },
        create: { name: child.name, slug: child.slug, icon: child.icon, parentId: category.id, sortOrder: ci },
      });
      for (const [si, s] of child.services.entries()) await upsertService(sub.id, s, si);
    }
  }

  console.log("Seeding plans…");
  const planIds = new Map<string, string>();
  for (const p of PLANS) {
    const { slug, ...data } = p;
    const plan = await prisma.plan.upsert({ where: { slug }, update: data, create: { slug, ...data } });
    planIds.set(slug, plan.id);
  }

  console.log("Seeding users…");
  await upsertUser({ fullName: "مدیر سیستم", phone: "09120000000", email: "admin@servino.local", role: "ADMIN", password: ADMIN_PASSWORD });

  const customer = await upsertUser({ fullName: "سارا محمدی", phone: "09120000001", email: "customer@servino.local", role: "CUSTOMER", password: DEMO_PASSWORD });
  await prisma.customerProfile.upsert({ where: { userId: customer.id }, update: {}, create: { userId: customer.id } });
  const hasAddress = await prisma.address.count({ where: { userId: customer.id } });
  if (!hasAddress) {
    await prisma.address.create({
      data: { userId: customer.id, title: "خانه", cityId: cityIds.get("tehran")!, line: "تهران، خیابان ولیعصر، کوچه نمونه، پلاک ۱۰", isDefault: true },
    });
  }

  // Approved provider with services, areas and an active subscription.
  const provider = await upsertUser({ fullName: "علی رضایی", phone: "09120000002", email: "provider@servino.local", role: "PROVIDER", password: DEMO_PASSWORD });
  const providerProfile = await prisma.providerProfile.upsert({
    where: { userId: provider.id },
    update: { verificationStatus: "APPROVED" },
    create: {
      userId: provider.id,
      displayName: "خدمات فنی رضایی",
      bio: "بیش از ۱۰ سال تجربه در تعمیر لوازم خانگی و تأسیسات ساختمان.",
      yearsOfExperience: 10,
      verificationStatus: "APPROVED",
      submittedAt: new Date(),
      reviewedAt: new Date(),
    },
  });
  for (const slug of ["refrigerator-repair", "washing-machine-repair", "plumbing", "electrical"]) {
    await prisma.providerService.upsert({
      where: { providerId_serviceId: { providerId: providerProfile.id, serviceId: serviceIds.get(slug)! } },
      update: {},
      create: { providerId: providerProfile.id, serviceId: serviceIds.get(slug)! },
    });
  }
  for (const slug of ["tehran", "shahriar", "karaj"]) {
    await prisma.serviceArea.upsert({
      where: { providerId_cityId: { providerId: providerProfile.id, cityId: cityIds.get(slug)! } },
      update: {},
      create: { providerId: providerProfile.id, cityId: cityIds.get(slug)! },
    });
  }
  for (const name of ["تعمیر یخچال", "لوله‌کشی", "برق‌کاری"]) {
    await prisma.providerSkill.upsert({
      where: { providerId_name: { providerId: providerProfile.id, name } },
      update: {},
      create: { providerId: providerProfile.id, name },
    });
  }
  const activeSub = await prisma.subscription.findFirst({ where: { userId: provider.id, status: "ACTIVE" } });
  if (!activeSub) {
    const plan = PLANS[1];
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        userId: provider.id,
        planId: planIds.get(plan.slug)!,
        status: "ACTIVE",
        startsAt,
        endsAt,
        planSnapshot: {
          name: plan.name,
          price: plan.price,
          durationDays: plan.durationDays,
          maxRequestsPerPeriod: plan.maxRequestsPerPeriod,
          maxOffersPerPeriod: plan.maxOffersPerPeriod,
        },
      },
    });
  }

  // Provider awaiting admin review (to exercise the verification workflow).
  const pending = await upsertUser({ fullName: "مریم کاظمی", phone: "09120000003", email: "pending@servino.local", role: "PROVIDER", password: DEMO_PASSWORD });
  await prisma.providerProfile.upsert({
    where: { userId: pending.id },
    update: {},
    create: {
      userId: pending.id,
      displayName: "نظافت کاظمی",
      bio: "ارائه خدمات نظافت منزل و محل کار با تیم مجرب و مواد شوینده استاندارد.",
      yearsOfExperience: 3,
      verificationStatus: "PENDING",
      submittedAt: new Date(),
    },
  });
  const pendingProfile = await prisma.providerProfile.findUniqueOrThrow({ where: { userId: pending.id } });
  await prisma.providerService.upsert({
    where: { providerId_serviceId: { providerId: pendingProfile.id, serviceId: serviceIds.get("home-cleaning")! } },
    update: {},
    create: { providerId: pendingProfile.id, serviceId: serviceIds.get("home-cleaning")! },
  });
  await prisma.serviceArea.upsert({
    where: { providerId_cityId: { providerId: pendingProfile.id, cityId: cityIds.get("isfahan")! } },
    update: {},
    create: { providerId: pendingProfile.id, cityId: cityIds.get("isfahan")! },
  });

  // Featured placement for the approved provider (independent of subscriptions).
  const hasFeatured = await prisma.featuredProvider.count({ where: { providerId: providerProfile.id } });
  if (!hasFeatured) {
    const now = new Date();
    await prisma.featuredProvider.createMany({
      data: (["HOME", "CATEGORY", "SEARCH"] as const).map((placement) => ({
        providerId: providerProfile.id,
        placement,
        startsAt: now,
        endsAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        sortOrder: 0,
      })),
    });
  }

  console.log("Seeding site settings…");
  const settings: Record<string, unknown> = {
    "site.name": "سروینو",
    "site.supportPhone": "021-00000000",
    "site.supportEmail": "support@servino.local",
    "requests.defaultExpiryDays": 7,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value: value as never }, create: { key, value: value as never } });
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
