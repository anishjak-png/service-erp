import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant";

/** Admin list including inactive partners. */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tenantFilter = tenantWhere(session);

  const partners = await prisma.outsourcePartner.findMany({
    where: tenantFilter,
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json(partners);
}
