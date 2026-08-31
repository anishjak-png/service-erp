import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { requireTenantId } from "@/lib/tenant";
import { slugify } from "@/lib/tenant";
import { todayIstDate } from "@/lib/tokens";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantId = requireTenantId(session);
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { tokenSequence: { select: { lastNum: true, lastResetOn: true } } },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    phone: tenant.phone ?? "",
    logoUrl: tenant.logoUrl,
    jobPrefix: tenant.jobPrefix,
    tokenPrefix: tenant.tokenPrefix,
    tokenResetDaily: tenant.tokenResetDaily,
    tokenLastNum: tenant.tokenSequence?.lastNum ?? 0,
    status: tenant.status,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantId = requireTenantId(session);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    name?: string;
    phone?: string;
    logoUrl?: string | null;
    jobPrefix?: string;
    tokenPrefix?: string;
    tokenResetDaily?: boolean;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    data.phone = body.phone.trim();
  }
  if (body.logoUrl === null || typeof body.logoUrl === "string") {
    data.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
  }
  if (typeof body.jobPrefix === "string") {
    const prefix = body.jobPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (prefix.length < 1 || prefix.length > 6) {
      return NextResponse.json(
        { error: "Job prefix must be 1–6 letters/numbers" },
        { status: 400 }
      );
    }
    data.jobPrefix = prefix;
  }
  if (typeof body.tokenPrefix === "string") {
    const prefix = body.tokenPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (prefix.length < 1 || prefix.length > 6) {
      return NextResponse.json(
        { error: "Token prefix must be 1–6 letters/numbers" },
        { status: 400 }
      );
    }
    data.tokenPrefix = prefix;
  }
  if (typeof body.tokenResetDaily === "boolean") {
    data.tokenResetDaily = body.tokenResetDaily;
  }

  // slug changes are sensitive; allow only via dedicated field with uniqueness check
  let nextSlug: string | undefined;
  if (typeof body.slug === "string" && body.slug.trim()) {
    nextSlug = slugify(body.slug);
    if (!nextSlug || nextSlug.length < 2) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    const clash = await prisma.tenant.findFirst({
      where: { slug: nextSlug, NOT: { id: tenantId } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }
  }

  if (body.resetTokenSequence === true) {
    await prisma.tokenSequence.upsert({
      where: { tenantId },
      update: { lastNum: 0, lastResetOn: todayIstDate() },
      create: { tenantId, lastNum: 0, lastResetOn: todayIstDate() },
    });
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...data,
      ...(nextSlug ? { slug: nextSlug } : {}),
    },
    include: { tokenSequence: { select: { lastNum: true, lastResetOn: true } } },
  });

  session.tenantSlug = tenant.slug;
  session.tenantName = tenant.name;
  await session.save();

  return NextResponse.json({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    phone: tenant.phone ?? "",
    logoUrl: tenant.logoUrl,
    jobPrefix: tenant.jobPrefix,
    tokenPrefix: tenant.tokenPrefix,
    tokenResetDaily: tenant.tokenResetDaily,
    tokenLastNum: tenant.tokenSequence?.lastNum ?? 0,
    status: tenant.status,
  });
}
