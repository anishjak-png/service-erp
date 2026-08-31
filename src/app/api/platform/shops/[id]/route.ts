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
  const status = typeof body.status === "string" ? body.status.trim() : "";

  if (status !== "active" && status !== "suspended") {
    return NextResponse.json(
      { error: "Status must be active or suspended" },
      { status: 400 }
    );
  }

  const shop = await prisma.tenant.findUnique({ where: { id } });
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  const updated = await prisma.tenant.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });

  return NextResponse.json(updated);
}
