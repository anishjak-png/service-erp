import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  isValidMobile,
  normalizeMobile,
} from "@/lib/password";
import { getTenantBySlug, slugify } from "@/lib/tenant";
import { seedGenericAppliances } from "@/lib/tenant-seed";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shopName =
      typeof body.shopName === "string" ? body.shopName.trim() : "";
    const adminName =
      typeof body.adminName === "string" ? body.adminName.trim() : "";
    const adminMobileRaw =
      typeof body.adminMobile === "string" ? body.adminMobile : "";
    const adminPin =
      typeof body.adminPin === "string"
        ? body.adminPin
        : typeof body.password === "string"
          ? body.password
          : "";
    const slugInput =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim()
        : shopName;

    if (!shopName) {
      return NextResponse.json({ error: "Shop name is required" }, { status: 400 });
    }
    if (!adminName) {
      return NextResponse.json({ error: "Admin name is required" }, { status: 400 });
    }
    if (!isValidMobile(adminMobileRaw)) {
      return NextResponse.json(
        { error: "Valid 10-digit admin mobile required" },
        { status: 400 }
      );
    }
    if (!adminPin || adminPin.length < 4) {
      return NextResponse.json(
        { error: "Admin PIN/password must be at least 4 characters" },
        { status: 400 }
      );
    }

    const slug = slugify(slugInput);
    if (!slug || slug.length < 2) {
      return NextResponse.json(
        { error: "Shop slug must be at least 2 characters (letters/numbers)" },
        { status: 400 }
      );
    }

    const existing = await getTenantBySlug(slug);
    if (existing) {
      return NextResponse.json(
        { error: "That shop URL slug is already taken" },
        { status: 409 }
      );
    }

    const adminMobile = normalizeMobile(adminMobileRaw);
    const passwordHash = await hashPassword(adminPin);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: shopName,
          jobPrefix: "SE",
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

      await tx.notificationSettings.create({
        data: { tenantId: tenant.id },
      });

      return { tenant, admin };
    });

    await seedGenericAppliances(prisma, result.tenant.id);

    return NextResponse.json(
      {
        tenant: {
          id: result.tenant.id,
          slug: result.tenant.slug,
          name: result.tenant.name,
        },
        admin: {
          id: result.admin.id,
          name: result.admin.name,
          mobile: result.admin.mobile,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/auth/signup]", error);
    const message =
      error instanceof Error ? error.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
