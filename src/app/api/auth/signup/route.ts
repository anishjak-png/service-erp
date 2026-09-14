import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Shop signup is closed. Contact Service ERP." },
    { status: 403 }
  );
}
