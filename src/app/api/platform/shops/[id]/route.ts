import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
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

  if (!status && !hasTariffNotes && !hasPassword && !hasLicense) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const shop = await prisma.tenant.findUnique({ where: { id } });
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
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

  if (hasPassword) {
    const admin = await prisma.staffUser.findFirst({
      where: { tenantId: id, role: "admin" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (admin) {
      await prisma.staffUser.update({
        where: { id: admin.id },
        data: { passwordHash: await hashPassword(body.adminPassword.trim()) },
      });
    }
  }

  return NextResponse.json(updated);
}
