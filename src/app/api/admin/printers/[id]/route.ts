import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parsePrinterPurposes } from "@/lib/printers";
import { tenantWhere } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json();
  const existing = await prisma.shopPrinter.findFirst({
    where: { ...tenantWhere(session), id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Printer not found" }, { status: 404 });
  }
  const printer = await prisma.shopPrinter.update({
    where: { id },
    data: {
      active: body.active !== undefined ? Boolean(body.active) : undefined,
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      purposes: Array.isArray(body.purposes)
        ? JSON.stringify(parsePrinterPurposes(JSON.stringify(body.purposes)))
        : undefined,
    },
  });
  return NextResponse.json({ printer });
}
