import { NextResponse } from "next/server";
import {
  enqueueReceiptPrint,
  getLatestPrintStatus,
  toPrintStatusResponse,
} from "@/lib/print-queue";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tenantWhere } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

async function resolveJobCardId(id: string, tenantId: string) {
  const job = await prisma.jobCard.findFirst({
    where: { tenantId, OR: [{ id }, { jobNumber: id }] },
    select: { id: true },
  });
  return job?.id ?? null;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tenantId } = tenantWhere(session);
  const { id } = await context.params;
  const jobCardId = await resolveJobCardId(id, tenantId);

  if (!jobCardId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const printJob = await enqueueReceiptPrint(jobCardId, {
    reprint: true,
    tenantId,
  });
  return NextResponse.json({
    printJobId: printJob.id,
    status: printJob.status,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tenantId } = tenantWhere(session);
  const { id } = await context.params;
  const jobCardId = await resolveJobCardId(id, tenantId);

  if (!jobCardId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const status = await getLatestPrintStatus(jobCardId, tenantId);
  return NextResponse.json(
    toPrintStatusResponse(status) ?? {
      status: "Pending",
      attempts: 0,
      errorMessage: null,
      printedAt: null,
    }
  );
}
