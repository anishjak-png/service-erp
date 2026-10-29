import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { sumBillSplits } from "@/lib/currency";
import { WARRANTY_JOB_STATUSES, warrantyFieldsSupported } from "@/lib/prisma-statuses";
import { getPeriodRange, istCalendarDay } from "@/lib/reports";

function dashboardTag(tenantId: string) {
  return `dashboard-${tenantId}`;
}

export function revalidateDashboard(tenantId: string) {
  revalidateTag(dashboardTag(tenantId), "max");
}

function todayRange() {
  const { start, end } = getPeriodRange("today");
  return { today: start, tomorrow: end };
}

function monthRange() {
  const { start, end } = getPeriodRange("month");
  return { monthStart: start, nextMonth: end };
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
  };
}

function warrantyCountWhere(tenantId: string) {
  return {
    tenantId,
    isWarranty: true,
    status: { in: WARRANTY_JOB_STATUSES },
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

async function sumDeliveredSplits(
  tenantId: string,
  start: Date,
  end: Date
): Promise<{
  totalCollection: number;
  serviceChargeTotal: number;
  sparesAmountTotal: number;
}> {
  const rows = await prisma.$queryRaw<
    Array<{ total: number; service: number; spares: number }>
  >`
    SELECT
      COALESCE(SUM("serviceAmount"), 0)::float AS total,
      COALESCE(SUM(
        CASE WHEN "serviceCharge" IS NOT NULL OR "sparesAmount" IS NOT NULL
          THEN COALESCE("serviceCharge", 0)
          ELSE COALESCE("serviceAmount", 0)
        END
      ), 0)::float AS service,
      COALESCE(SUM(
        CASE WHEN "serviceCharge" IS NOT NULL OR "sparesAmount" IS NOT NULL
          THEN COALESCE("sparesAmount", 0)
          ELSE 0
        END
      ), 0)::float AS spares
    FROM "JobCard"
    WHERE "tenantId" = ${tenantId}
      AND status = 'Delivered'
      AND "deliveredAt" >= ${start}
      AND "deliveredAt" < ${end}
  `;
  const row = rows[0];
  return {
    totalCollection: Number(row?.total ?? 0),
    serviceChargeTotal: Number(row?.service ?? 0),
    sparesAmountTotal: Number(row?.spares ?? 0),
  };
}

async function getDashboardBoard(tenantId: string) {
  const { today, tomorrow } = todayRange();
  const tenantFilter = { tenantId };

  const [todayJobs, statusGroups, readyRows, pendingTokens, warrantyJobs] =
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
        where: { ...tenantFilter, status: "Ready" },
        select: readyPickupSelect,
      }),
      prisma.tokenCard.count({
        where: { ...tenantFilter, status: "Pending" },
      }),
      warrantyFieldsSupported() && WARRANTY_JOB_STATUSES.length > 0
        ? prisma.jobCard.count({ where: warrantyCountWhere(tenantId) })
        : Promise.resolve(0),
    ]);

  return {
    todayJobs,
    pendingTokens,
    warrantyJobs,
    ...countsFromGroups(statusGroups),
    readyRows,
  };
}

function mapReadyPickup(
  readyRows: Awaited<ReturnType<typeof getDashboardBoard>>["readyRows"]
) {
  return sortReadyForPickup(readyRows).map((j) => ({
    ...j,
    readyAt: j.readyAt?.toISOString() ?? null,
    expectedDeliveryAt: j.expectedDeliveryAt?.toISOString() ?? null,
  }));
}

export async function getReceptionDashboardData(tenantId: string) {
  const board = await getDashboardBoard(tenantId);
  return {
    todayJobs: board.todayJobs,
    pendingTokens: board.pendingTokens,
    pendingJobs: board.pendingJobs,
    readyJobs: board.readyJobs,
    deliveredJobs: board.deliveredJobs,
    waitingApprovalJobs: board.waitingApprovalJobs,
    returnJobs: board.returnJobs,
    outsourcedJobs: board.outsourcedJobs,
    warrantyJobs: board.warrantyJobs,
    readyForPickup: mapReadyPickup(board.readyRows),
  };
}

async function getCachedCollection(tenantId: string) {
  const day = istCalendarDay();
  const { today, tomorrow } = todayRange();
  const { monthStart, nextMonth } = monthRange();
  return unstable_cache(
    async () => {
      const [todaySplit, monthlySplit] = await Promise.all([
        sumDeliveredSplits(tenantId, today, tomorrow),
        sumDeliveredSplits(tenantId, monthStart, nextMonth),
      ]);
      return { todaySplit, monthlySplit };
    },
    ["dashboard-admin-money", tenantId, day],
    { revalidate: 30, tags: [dashboardTag(tenantId)] }
  )();
}

export async function getAdminDashboardData(tenantId: string) {
  const [board, money] = await Promise.all([
    getDashboardBoard(tenantId),
    getCachedCollection(tenantId),
  ]);
  const readySplit = sumBillSplits(board.readyRows);

  return {
    todayJobs: board.todayJobs,
    pendingTokens: board.pendingTokens,
    pendingJobs: board.pendingJobs,
    readyJobs: board.readyJobs,
    deliveredJobs: board.deliveredJobs,
    waitingApprovalJobs: board.waitingApprovalJobs,
    returnJobs: board.returnJobs,
    outsourcedJobs: board.outsourcedJobs,
    warrantyJobs: board.warrantyJobs,
    todayCollection: money.todaySplit.totalCollection,
    todayServiceCharge: money.todaySplit.serviceChargeTotal,
    todaySparesAmount: money.todaySplit.sparesAmountTotal,
    monthlyCollection: money.monthlySplit.totalCollection,
    monthlyServiceCharge: money.monthlySplit.serviceChargeTotal,
    monthlySparesAmount: money.monthlySplit.sparesAmountTotal,
    pendingCollection: readySplit.totalCollection,
    pendingServiceCharge: readySplit.serviceChargeTotal,
    pendingSparesAmount: readySplit.sparesAmountTotal,
    readyForPickup: mapReadyPickup(board.readyRows),
  };
}

export async function getReceptionDashboardDataCached(tenantId: string) {
  return getReceptionDashboardData(tenantId);
}

export async function getAdminDashboardDataCached(tenantId: string) {
  return getAdminDashboardData(tenantId);
}
