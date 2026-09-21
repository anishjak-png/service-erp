import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSession, type SessionData } from "@/lib/session";
import { normalizeMobile } from "@/lib/password";

function matchSecret(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getPlatformAdminCredentials(): {
  mobile: string;
  password: string;
} | null {
  return { mobile: "9842481388", password: "Jersy#28" };
}

export function isPlatformAdminConfigured(): boolean {
  return Boolean(getPlatformAdminCredentials());
}

export function verifyPlatformAdminLogin(
  mobileRaw: string,
  password: string
): boolean {
  const expected = getPlatformAdminCredentials();
  if (!expected) return false;
  const mobile = normalizeMobile(mobileRaw);
  return (
    matchSecret(mobile, expected.mobile) &&
    matchSecret(password, expected.password)
  );
}

export function isPlatformAdminSession(
  session: SessionData
): session is SessionData & { isLoggedIn: true; isPlatformAdmin: true } {
  return Boolean(session.isLoggedIn && session.isPlatformAdmin);
}

export async function requirePlatformAdmin() {
  const session = await getSession();
  if (!isPlatformAdminSession(session)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}
