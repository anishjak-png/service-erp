import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/jobs";
import { STATUS_LABELS } from "@/lib/constants";
import {
  getTenantBySlug,
  resolveTenantSlugFromRequest,
} from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const mobile = normalizeMobile(request.nextUrl.searchParams.get("mobile") ?? "");

  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Valid 10-digit mobile required" }, { status: 400 });
  }

  const slug = resolveTenantSlugFromRequest({
    host: request.headers.get("host"),
    searchParams: request.nextUrl.searchParams,
    headerSlug: request.headers.get("x-tenant-slug"),
  });

  if (!slug) {
    return NextResponse.json(
      { error: "Tenant required. Pass ?tenant=slug or use a tenant subdomain." },
      { status: 400 }
    );
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== "active") {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const jobs = await prisma.jobCard.findMany({
    where: {
      tenantId: tenant.id,
      customer: { tenantId: tenant.id, mobile },
    },
    include: { customer: true },
    orderBy: { receivedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    jobs.map((job) => ({
      jobNumber: job.jobNumber,
      applianceType: job.applianceType,
      brand: job.brand,
      model: job.model,
      status: job.status,
      statusLabel: STATUS_LABELS[job.status] ?? job.status,
      receivedAt: job.receivedAt,
    }))
  );
}
