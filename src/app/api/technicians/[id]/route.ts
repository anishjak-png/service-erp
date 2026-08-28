import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { tenantWhere } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const tenantFilter = tenantWhere(session);

  const { id } = await context.params;
  const { name } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const existing = await prisma.technician.findFirst({
    where: { ...tenantFilter, id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Technician not found" }, { status: 404 });
  }

  const duplicate = await prisma.technician.findFirst({
    where: { ...tenantFilter, name: name.trim(), id: { not: id } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "Technician name already exists" },
      { status: 409 }
    );
  }

  const technician = await prisma.technician.update({
    where: { id },
    data: { name: name.trim(), active: true },
    include: { applianceMappings: true },
  });

  return NextResponse.json(technician);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const tenantFilter = tenantWhere(session);

  const { id } = await context.params;

  const existing = await prisma.technician.findFirst({
    where: { ...tenantFilter, id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Technician not found" }, { status: 404 });
  }

  const activeJobs = await prisma.jobCard.count({
    where: {
      ...tenantFilter,
      assignedTechnicianId: id,
      status: { in: ["Pending", "WaitingForCustomerApproval", "Ready", "Return"] },
    },
  });

  if (activeJobs > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete — ${activeJobs} active job(s) assigned to this technician`,
      },
      { status: 409 }
    );
  }

  await prisma.applianceTechnician.deleteMany({
    where: { ...tenantFilter, technicianId: id },
  });

  await prisma.technician.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
