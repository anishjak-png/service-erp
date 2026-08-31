import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform-auth";

export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  return NextResponse.json({ isPlatformAdmin: true });
}
