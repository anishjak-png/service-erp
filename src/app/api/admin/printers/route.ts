import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parsePrinterPurposes } from "@/lib/printers";

export async function GET() {
  const session = await requireAdmin();
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const printers = await prisma.shopPrinter.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    printers: printers.map((p) => ({
      ...p,
      purposes: parsePrinterPurposes(p.purposes),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session?.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const printerId = String(body.printerId ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
  const purposes = parsePrinterPurposes(
    JSON.stringify(Array.isArray(body.purposes) ? body.purposes : ["job_new"])
  );
  if (!name || !printerId) {
    return NextResponse.json(
      { error: "Printer name and ID are required" },
      { status: 400 }
    );
  }
  const printer = await prisma.shopPrinter.create({
    data: {
      tenantId: session.tenantId,
      name,
      printerId,
      purposes: JSON.stringify(purposes),
    },
  });
  return NextResponse.json({
    printer: { ...printer, purposes: parsePrinterPurposes(printer.purposes) },
  });
}
