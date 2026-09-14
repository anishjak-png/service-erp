import { prisma } from "@/lib/db";
import { sumBillSplits } from "@/lib/currency";

function todayRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { today, tomorrow };
}

function monthRange() {
  const { today } = todayRange();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { monthStart, nextMonth };
}

function countsFromGroups(groups: Array<{ status: string; _count: { id: number } }>) {
  const map = Object.fromEntries(groups.map((g) => [g.status, g._count.id]));
  return {
    pendingJobs: map.Pending ?? 0,
    readyJobs: map.Ready ?? 0,
    deliveredJobs: map.Delivered ?? 0,
    waitingApprovalJobs: map.WaitingForCustomerApproval ?? 0,
    returnJobs: map.Return ?? 0,
    outsourcedJobs: map.Outsourced ?? 0,
    warrantyJobs:
      (map.WarrantyPending ?? 0) + (map.WarrantyWithCompany ?? 0),
  };
}

const readyPickupSelect = {
  id: true,
  jobNumber: true,
  brand: true,
  applianceType: true,
  readyAt: true,
  serviceAmount: true,
  serviceCharge: true,
  sparesAmount: true,
  deliveryContactStatus: true,
  expectedDeliveryAt: true,
  customer: { select: { name: true, mobile: true } },
  completedByTechnician: { select: { name: true } },
  completedByOutsource: { select: { name: true } },
} as const;

function jobNumberSortKey(jobNumber: string): number {
  const n = Number.parseInt(jobNumber.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Oldest UT number first (numeric). */
function sortReadyForPickup<T extends { jobNumber: string }>(jobs: T[]): T[] {
  return [...jobs].sort(
    (a, b) => jobNumberSortKey(a.jobNumber) - jobNumberSortKey(b.jobNumber)
  );
}

export async function getReceptionDashboardData(tenantId: string) {
  const { today, tomorrow } = todayRange();
  const tenantFilter = { tenantId };

  const [todayJobs, statusGroups, readyRows, pendingTokens] = await Promise.all([
    prisma.jobCard.count({
      where: { ...tenantFilter, receivedAt: { gte: today, lt: tomorrow } },
    }),
    prisma.jobCard.groupBy({
      by: ["status"],
      _count: { id: true },
      where: tenantFilter,
    }),
    prisma.jobCard.findMany({
      where: { ...tenantFilter, status: "Ready" },
      select: readyPickupSelect,
    }),
    prisma.tokenCard.count({
      where: { ...tenantFilter, status: "Pending" },
    }),
  ]);

  const counts = countsFromGroups(statusGroups);

  return {
    todayJobs,
    pendingTokens,
    ...counts,
    readyForPickup: sortReadyForPickup(readyRows).map((j) => ({
      ...j,
      readyAt: j.readyAt?.toISOString() ?? null,
      expectedDeliveryAt: j.expectedDeliveryAt?.toISOString() ?? null,
    })),
  };
}

export async function getAdminDashboardData(tenantId: string) {
  const { today, tomorrow } = todayRange();
  const { monthStart, nextMonth } = monthRange();
  const tenantFilter = { tenantId };

  const [todayJobs, statusGroups, todayDelivered, monthlyDelivered, readyRows, pendingTokens] =
    await Promise.all([
      prisma.jobCard.count({
        where: { ...tenantFilter, receivedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.jobCard.groupBy({
        by: ["status"],
        _count: { id: true },
        where: tenantFilter,
      }),
      prisma.jobCard.findMany({
        where: {
          ...tenantFilter,
          status: "Delivered",
          deliveredAt: { gte: today, lt: tomorrow },
        },
        select: {
          serviceAmount: true,
          serviceCharge: true,
          sparesAmount: true,
        },
      }),
      prisma.jobCard.findMany({
        where: {
          ...tenantFilter,
          status: "Delivered",
          deliveredAt: { gte: monthStart, lt: nextMonth },
        },
        select: {
          serviceAmount: true,
          serviceCharge: true,
          sparesAmount: true,
        },
      }),
      prisma.jobCard.findMany({
        where: { ...tenantFilter, status: "Ready" },
        select: readyPickupSelect,
      }),
      prisma.tokenCard.count({
        where: { ...tenantFilter, status: "Pending" },
      }),
    ]);

  const counts = countsFromGroups(statusGroups);
  const todaySplit = sumBillSplits(todayDelivered);
  const monthlySplit = sumBillSplits(monthlyDelivered);
  const readySplit = sumBillSplits(readyRows);

  return {
    todayJobs,
    pendingTokens,
    ...counts,
    todayCollection: todaySplit.totalCollection,
    todayServiceCharge: todaySplit.serviceChargeTotal,
    todaySparesAmount: todaySplit.sparesAmountTotal,
    monthlyCollection: monthlySplit.totalCollection,
    monthlyServiceCharge: monthlySplit.serviceChargeTotal,
    monthlySparesAmount: monthlySplit.sparesAmountTotal,
    pendingCollection: readySplit.totalCollection,
    pendingServiceCharge: readySplit.serviceChargeTotal,
    pendingSparesAmount: readySplit.sparesAmountTotal,
    readyForPickup: sortReadyForPickup(readyRows).map((j) => ({
      ...j,
      readyAt: j.readyAt?.toISOString() ?? null,
      expectedDeliveryAt: j.expectedDeliveryAt?.toISOString() ?? null,
    })),
  };
}

const DASH_TTL_MS = 12_000;
const dashMemory = new Map<string, { at: number; data: unknown }>();

export async function getReceptionDashboardDataCached(tenantId: string) {
  const key = `reception:${tenantId}`;
  const hit = dashMemory.get(key);
  if (hit && Date.now() - hit.at < DASH_TTL_MS) {
    return hit.data as Awaited<ReturnType<typeof getReceptionDashboardData>>;
  }
  const data = await getReceptionDashboardData(tenantId);
  dashMemory.set(key, { at: Date.now(), data });
  return data;
}

export async function getAdminDashboardDataCached(tenantId: string) {
  const key = `admin:${tenantId}`;
  const hit = dashMemory.get(key);
  if (hit && Date.now() - hit.at < DASH_TTL_MS) {
    return hit.data as Awaited<ReturnType<typeof getAdminDashboardData>>;
  }
  const data = await getAdminDashboardData(tenantId);
  dashMemory.set(key, { at: Date.now(), data });
  return data;
}
