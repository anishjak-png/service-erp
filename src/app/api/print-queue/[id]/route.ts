import { NextRequest, NextResponse } from "next/server";
import {
  markPrintJobFailed,
  markPrintJobPrinted,
  markPrintJobPrinting,
} from "@/lib/print-queue";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

function resolveBridgeTenantId(request: NextRequest): string | null {
  return (
    request.headers.get("x-tenant-id")?.trim() ||
    request.headers.get("TENANT_ID")?.trim() ||
    process.env.TENANT_ID?.trim() ||
    process.env.PRINT_TENANT_ID?.trim() ||
    null
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const tenantId = resolveBridgeTenantId(request);
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant required (X-Tenant-Id header or TENANT_ID env)" },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const printJob = await prisma.printJob.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!printJob) {
    return NextResponse.json({ error: "Print job not found" }, { status: 404 });
  }

  const body = await request.json();

  if (body.status === "printing") {
    await markPrintJobPrinting(id);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "done" || body.status === "printed") {
    await markPrintJobPrinted(id);
    return NextResponse.json({ ok: true });
  }

  if (body.status === "failed") {
    const errorMessage =
      typeof body.error === "string" ? body.error : "Print failed";
    await markPrintJobFailed(id, errorMessage);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid status" }, { status: 400 });
}
