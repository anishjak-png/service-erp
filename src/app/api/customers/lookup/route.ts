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
  const slim = request.nextUrl.searchParams.get("slim") === "1";

  if (mobile.length !== 10) {
    return NextResponse.json({ error: "Valid mobile required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { tenantId_mobile: { tenantId, mobile } },
    select: {
      name: true,
      address: true,
      mobile: true,
      allowWhatsappNotifications: true,
      jobCards: slim
        ? false
        : {
            where: { tenantId },
            orderBy: { receivedAt: "desc" },
            take: 5,
            select: {
              id: true,
              jobNumber: true,
              status: true,
              applianceType: true,
              brand: true,
              receivedAt: true,
            },
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
    recentJobs: customer.jobCards ?? [],
  });
}
