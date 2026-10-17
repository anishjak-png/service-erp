import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  isValidMobile,
  normalizeMobile,
} from "@/lib/password";
import { requirePlatformAdmin } from "@/lib/platform-auth";
import { parseLicenseDate } from "@/lib/tenant";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status =
    typeof body.status === "string" ? body.status.trim() : undefined;
  const hasTariffNotes = typeof body.tariffNotes === "string";
  const hasPassword =
    typeof body.adminPassword === "string" && body.adminPassword.trim().length > 0;
  const hasMobile = typeof body.adminMobile === "string";
  const hasLicense = "licenseExpiresAt" in body;

  if (status && status !== "active" && status !== "suspended") {
    return NextResponse.json(
      { error: "Status must be active or locked" },
      { status: 400 }
    );
  }

  let licenseExpiresAt: Date | null | undefined;
  if (hasLicense) {
    if (body.licenseExpiresAt === null || body.licenseExpiresAt === "") {
      licenseExpiresAt = null;
    } else if (typeof body.licenseExpiresAt === "string") {
      const parsed = parseLicenseDate(body.licenseExpiresAt);
      if (!parsed) {
        return NextResponse.json(
          { error: "License date must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      licenseExpiresAt = parsed;
    } else {
      return NextResponse.json(
        { error: "License date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
  }

  let adminMobile: string | undefined;
  if (hasMobile) {
    if (!isValidMobile(body.adminMobile)) {
      return NextResponse.json(
        { error: "Valid 10-digit admin mobile required" },
        { status: 400 }
      );
    }
    adminMobile = normalizeMobile(body.adminMobile);
  }

  if (hasPassword && body.adminPassword.trim().length < 4) {
    return NextResponse.json(
      { error: "Admin password must be at least 4 characters" },
      { status: 400 }
    );
  }

  if (!status && !hasTariffNotes && !hasPassword && !hasLicense && !hasMobile) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const shop = await prisma.tenant.findUnique({ where: { id } });
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const admin = await prisma.staffUser.findFirst({
    where: { tenantId: id, role: "admin" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (hasMobile && adminMobile) {
    const taken = await prisma.staffUser.findUnique({
      where: { mobile: adminMobile },
      select: { id: true },
    });
    if (taken && taken.id !== admin?.id) {
      return NextResponse.json(
        { error: "This mobile is already used" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(hasTariffNotes ? { tariffNotes: body.tariffNotes.trim() } : {}),
      ...(hasPassword ? { adminPasswordNote: body.adminPassword.trim() } : {}),
      ...(hasLicense ? { licenseExpiresAt } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      tariffNotes: true,
      adminPasswordNote: true,
      licenseExpiresAt: true,
    },
  });

  if (admin && (hasPassword || hasMobile)) {
    await prisma.staffUser.update({
      where: { id: admin.id },
      data: {
        ...(hasMobile && adminMobile ? { mobile: adminMobile } : {}),
        ...(hasPassword
          ? { passwordHash: await hashPassword(body.adminPassword.trim()) }
          : {}),
      },
    });
  }

  return NextResponse.json(updated);
}
