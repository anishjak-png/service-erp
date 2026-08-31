import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tenantWhere } from "@/lib/tenant";

export async function POST() {
  const session = await getSession();
  if (
    !session.isLoggedIn ||
    (session.role !== "verifier" && session.role !== "admin")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.staffAlert.updateMany({
    where: {
      ...tenantWhere(session),
      role: session.role,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
