import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tenantWhere } from "@/lib/tenant";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.customer.findMany({
    where: tenantWhere(session),
    select: { id: true, name: true, mobile: true },
    orderBy: { name: "asc" },
    take: 8000,
  });

  return NextResponse.json(customers, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
