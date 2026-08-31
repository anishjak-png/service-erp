import { prisma } from "@/lib/db";
import {
  hashPassword,
  isValidMobile,
  normalizeMobile,
} from "@/lib/password";
import { getTenantBySlug, slugify } from "@/lib/tenant";
import { seedGenericAppliances } from "@/lib/tenant-seed";

export class CreateShopError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function jobPrefixFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  if (initials.length >= 1) return initials.slice(0, 6);
  return slugify(name).replace(/-/g, "").slice(0, 4).toUpperCase() || "SE";
}

export async function createShop(input: {
  shopName: string;
  adminName: string;
  adminMobile: string;
  adminPin: string;
  jobPrefix?: string;
  phone?: string;
}) {
  const shopName = input.shopName.trim();
  const adminName = input.adminName.trim();
  const adminPin = input.adminPin;
  const phone = input.phone?.trim() ?? "";

  if (!shopName) {
    throw new CreateShopError("Shop name is required");
  }
  if (!adminName) {
    throw new CreateShopError("Admin name is required");
  }
  if (!isValidMobile(input.adminMobile)) {
    throw new CreateShopError("Valid 10-digit admin mobile required");
  }
  if (!adminPin || adminPin.length < 4) {
    throw new CreateShopError(
      "Admin PIN/password must be at least 4 characters"
    );
  }

  const slug = slugify(shopName);
  if (!slug || slug.length < 2) {
    throw new CreateShopError(
      "Shop name must be at least 2 characters (letters/numbers)"
    );
  }

  const existing = await getTenantBySlug(slug);
  if (existing) {
    throw new CreateShopError("That shop name is already taken", 409);
  }

  let jobPrefix = (input.jobPrefix ?? jobPrefixFromName(shopName))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (jobPrefix.length < 1 || jobPrefix.length > 6) {
    jobPrefix = "SE";
  }

  const adminMobile = normalizeMobile(input.adminMobile);
  const passwordHash = await hashPassword(adminPin);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: shopName,
        phone,
        jobPrefix,
        tokenPrefix: "TK",
        tokenResetDaily: false,
        status: "active",
      },
    });

    const admin = await tx.staffUser.create({
      data: {
        tenantId: tenant.id,
        mobile: adminMobile,
        name: adminName,
        role: "admin",
        active: true,
        passwordHash,
      },
    });

    await tx.jobSequence.create({
      data: { tenantId: tenant.id, lastNum: 0 },
    });

    await tx.tokenSequence.create({
      data: { tenantId: tenant.id, lastNum: 0 },
    });

    await tx.notificationSettings.create({
      data: { tenantId: tenant.id },
    });

    return { tenant, admin };
  });

  await seedGenericAppliances(prisma, result.tenant.id);

  return {
    tenant: {
      id: result.tenant.id,
      slug: result.tenant.slug,
      name: result.tenant.name,
      phone: result.tenant.phone,
      jobPrefix: result.tenant.jobPrefix,
      status: result.tenant.status,
      createdAt: result.tenant.createdAt,
    },
    admin: {
      id: result.admin.id,
      name: result.admin.name,
      mobile: result.admin.mobile,
    },
  };
}
