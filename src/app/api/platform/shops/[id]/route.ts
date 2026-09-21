import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-auth";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status =
    typeof body.status === "string" ? body.status.trim() : undefined;
  const hasTariffNotes = typeof body.tariffNotes === "string";

  if (status && status !== "active" && status !== "suspended") {
    return NextResponse.json(
      { error: "Status must be active or locked" },
      { status: 400 }
    );
  }
  if (!status && !hasTariffNotes) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    );
  }

  const shop = await prisma.tenant.findUnique({ where: { id } });
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(hasTariffNotes ? { tariffNotes: body.tariffNotes.trim() } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      tariffNotes: true,
    },
  });

  return NextResponse.json(updated);
}
