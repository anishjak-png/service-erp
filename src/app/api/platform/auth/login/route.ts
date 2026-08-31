import { NextRequest, NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/session";
import {
  isPlatformAdminConfigured,
  verifyPlatformAdminLogin,
} from "@/lib/platform-auth";
import { isValidMobile } from "@/lib/password";

export async function POST(request: NextRequest) {
  if (!isPlatformAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform admin is not configured" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const mobile = typeof body.mobile === "string" ? body.mobile : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isValidMobile(mobile) || !password) {
    return NextResponse.json(
      { error: "Mobile and password are required" },
      { status: 400 }
    );
  }

  if (!verifyPlatformAdminLogin(mobile, password)) {
    return NextResponse.json(
      { error: "Invalid mobile or password" },
      { status: 401 }
    );
  }

  const session = await getSession();
  await clearSession(session);
  session.isLoggedIn = true;
  session.isPlatformAdmin = true;
  session.role = "admin";
  session.staffName = "Platform";
  await session.save();

  return NextResponse.json({ ok: true, isPlatformAdmin: true });
}
