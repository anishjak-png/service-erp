import { prisma } from "@/lib/db";
import {
  hashPassword,
  isValidMobile,
  normalizeMobile,
} from "@/lib/password";
import { allocateUniqueJobPrefix } from "@/lib/job-prefix";
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

function mapShopDbError(error: unknown): CreateShopError {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const message = error instanceof Error ? error.message : "";
  const target = (
    error as { meta?: { target?: string[] | string } } | undefined
  )?.meta?.target;
  const fields = Array.isArray(target) ? target : target ? [target] : [];

  if (code === "P2002") {
    if (fields.includes("mobile")) {
      return new CreateShopError("This mobile is already used", 409);
    }
    if (fields.includes("slug")) {
      return new CreateShopError("That shop name is already taken", 409);
    }
    if (fields.includes("jobPrefix")) {
      return new CreateShopError("That job prefix is already used by another shop", 409);
    }
    return new CreateShopError("That shop already exists", 409);
  }
  if (code === "P2022" || /tariffNotes/i.test(message)) {
    return new CreateShopError(
      "Database is missing a shop field. Update the schema and try again.",
      500
    );
  }
  if (code === "P2028" || /transaction/i.test(message)) {
    return new CreateShopError("Database timed out. Try again.", 503);
  }
  if (code === "P1001" || /Can't reach database/i.test(message)) {
    return new CreateShopError("Database unavailable. Try again.", 503);
  }
  return new CreateShopError("Could not create shop", 500);
}

export async function createShop(input: {
  shopName: string;
  adminName: string;
  adminMobile: string;
  adminPin: string;
  jobPrefix?: string;
  phone?: string;
  tariffNotes?: string;
  licenseExpiresAt?: Date | null;
}) {
  const shopName = input.shopName.trim();
  const adminName = input.adminName.trim();
  const adminPin = input.adminPin;
  const phone = input.phone?.trim() ?? "";
  const tariffNotes = input.tariffNotes?.trim() ?? "";
  const licenseExpiresAt = input.licenseExpiresAt ?? null;

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

  const jobPrefix = await allocateUniqueJobPrefix(
    input.jobPrefix ?? jobPrefixFromName(shopName)
  );

  const adminMobile = normalizeMobile(input.adminMobile);
  const mobileTaken = await prisma.staffUser.findUnique({
    where: { mobile: adminMobile },
    select: { id: true },
  });
  if (mobileTaken) {
    throw new CreateShopError("This mobile is already used", 409);
  }

  const passwordHash = await hashPassword(adminPin);

  const tenantData = {
    slug,
    name: shopName,
    phone,
    jobPrefix,
    tokenPrefix: "TK",
    tokenResetDaily: false,
    status: "active",
  };

  let tenant;
  try {
    tenant = await prisma.tenant.create({
      data: {
        ...tenantData,
        tariffNotes,
        adminPasswordNote: adminPin,
        licenseExpiresAt,
      },
    });
  } catch (first) {
    const msg = first instanceof Error ? first.message : "";
    const code =
      first && typeof first === "object" && "code" in first
        ? String((first as { code: unknown }).code)
        : "";
    if (
      code === "P2022" ||
      /tariffNotes|adminPasswordNote|licenseExpiresAt/i.test(msg)
    ) {
      try {
        tenant = await prisma.tenant.create({
          data: { ...tenantData, tariffNotes },
        });
      } catch (retry) {
        try {
          tenant = await prisma.tenant.create({ data: tenantData });
        } catch (error) {
          console.error("[createShop] tenant.create", error);
          throw mapShopDbError(error);
        }
      }
    } else {
      console.error("[createShop] tenant.create", first);
      throw mapShopDbError(first);
    }
  }

  if (!tenant) {
    throw new CreateShopError("Could not create shop", 500);
  }

  let admin;
  try {
    admin = await prisma.staffUser.create({
      data: {
        tenantId: tenant.id,
        mobile: adminMobile,
        name: adminName,
        role: "admin",
        active: true,
        passwordHash,
      },
    });

    await prisma.jobSequence.create({
      data: { tenantId: tenant.id, lastNum: 0 },
    });

    await prisma.tokenSequence.create({
      data: { tenantId: tenant.id, lastNum: 0 },
    });

    await prisma.notificationSettings.create({
      data: { tenantId: tenant.id },
    });
  } catch (error) {
    console.error("[createShop] shop records", error);
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    throw mapShopDbError(error);
  }

  try {
    await seedGenericAppliances(prisma, tenant.id);
  } catch (error) {
    console.error("[createShop] catalog seed failed", error);
  }

  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      phone: tenant.phone,
      jobPrefix: tenant.jobPrefix,
      status: tenant.status,
      tariffNotes: tenant.tariffNotes,
      adminPasswordNote: tenant.adminPasswordNote,
      licenseExpiresAt: tenant.licenseExpiresAt,
      createdAt: tenant.createdAt,
    },
    admin: {
      id: admin.id,
      name: admin.name,
      mobile: admin.mobile,
    },
  };
}
