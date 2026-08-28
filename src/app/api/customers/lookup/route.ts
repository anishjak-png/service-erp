import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/jobs";
import { getSession } from "@/lib/session";
import { requireTenantId } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const session = await getSession();
  const tenantId = requireTenantId(session);
  const mobile = normalizeMobile(
    request.nextUrl.searchParams.get("mobile") ?? ""
  );

  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Valid mobile required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { tenantId_mobile: { tenantId, mobile } },
    include: {
      jobCards: {
        where: { tenantId },
        orderBy: { receivedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    name: customer.name,
    address: customer.address,
    mobile: customer.mobile,
    allowWhatsappNotifications: customer.allowWhatsappNotifications,
    recentJobs: customer.jobCards,
  });
}
