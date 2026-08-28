import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/jobs";
import { tenantWhere } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const tenantFilter = tenantWhere(session);

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const where = q
    ? {
        ...tenantFilter,
        OR: [
          { mobile: { contains: normalizeMobile(q) } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { ...tenantFilter };

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      mobile: true,
      allowWhatsappNotifications: true,
      updatedAt: true,
      _count: { select: { jobCards: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      allowWhatsappNotifications: c.allowWhatsappNotifications,
      jobCount: c._count.jobCards,
      updatedAt: c.updatedAt,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const tenantFilter = tenantWhere(session);

  const body = await request.json();
  const customerId = body.customerId as string | undefined;

  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  if (body.allowWhatsappNotifications === undefined) {
    return NextResponse.json(
      { error: "allowWhatsappNotifications required" },
      { status: 400 }
    );
  }

  const existing = await prisma.customer.findFirst({
    where: { ...tenantFilter, id: customerId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { allowWhatsappNotifications: Boolean(body.allowWhatsappNotifications) },
    select: {
      id: true,
      name: true,
      mobile: true,
      allowWhatsappNotifications: true,
    },
  });

  return NextResponse.json(customer);
}
