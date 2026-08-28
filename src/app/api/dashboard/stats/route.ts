import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tenantWhere } from "@/lib/tenant";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantFilter = tenantWhere(session);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [
    todayJobs,
    pendingJobs,
    readyJobs,
    waitingApprovalJobs,
    todayDeliveries,
    monthlyJobs,
    technicianWise,
    brandWise,
    applianceWise,
  ] = await Promise.all([
    prisma.jobCard.count({
      where: { ...tenantFilter, receivedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.jobCard.count({ where: { ...tenantFilter, status: "Pending" } }),
    prisma.jobCard.count({ where: { ...tenantFilter, status: "Ready" } }),
    prisma.jobCard.count({
      where: { ...tenantFilter, status: "WaitingForCustomerApproval" },
    }),
    prisma.jobCard.count({
      where: {
        ...tenantFilter,
        status: "Delivered",
        deliveredAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.jobCard.count({
      where: { ...tenantFilter, receivedAt: { gte: monthStart, lt: nextMonth } },
    }),
    prisma.jobCard.groupBy({
      by: ["assignedTechnicianId"],
      _count: { id: true },
      where: {
        ...tenantFilter,
        status: { in: ["Pending", "WaitingForCustomerApproval", "Ready", "Return"] },
      },
    }),
    prisma.jobCard.groupBy({
      by: ["brand"],
      _count: { id: true },
      where: {
        ...tenantFilter,
        status: { in: ["Pending", "WaitingForCustomerApproval", "Ready", "Return"] },
      },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.jobCard.groupBy({
      by: ["applianceType"],
      _count: { id: true },
      where: {
        ...tenantFilter,
        status: { in: ["Pending", "WaitingForCustomerApproval", "Ready", "Return"] },
      },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  const technicianIds = technicianWise
    .map((t) => t.assignedTechnicianId)
    .filter((id): id is string => id != null);

  const technicians = technicianIds.length
    ? await prisma.technician.findMany({
        where: { ...tenantFilter, id: { in: technicianIds } },
        select: { id: true, name: true },
      })
    : [];

  const techNameById = Object.fromEntries(technicians.map((t) => [t.id, t.name]));

  return NextResponse.json({
    todayJobs,
    pendingJobs,
    readyJobs,
    waitingApprovalJobs,
    todayDeliveries,
    monthlyJobs,
    technicianWise: technicianWise.map((row) => ({
      name: row.assignedTechnicianId
        ? (techNameById[row.assignedTechnicianId] ?? "Unassigned")
        : "Unassigned",
      count: row._count.id,
    })),
    brandWise: brandWise.map((row) => ({
      name: row.brand,
      count: row._count.id,
    })),
    applianceWise: applianceWise.map((row) => ({
      name: row.applianceType,
      count: row._count.id,
    })),
  });
}
