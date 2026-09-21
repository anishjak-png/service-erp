import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type StaffRole = "reception" | "technician" | "admin" | "verifier";
export type DeviceStatus = "pending" | "approved" | "revoked";

export interface SessionData {
  role: StaffRole;
  isLoggedIn: boolean;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  jobPrefix?: string;
  staffUserId?: string;
  staffName?: string;
  deviceId?: string;
  deviceStatus?: DeviceStatus;
  technicianId?: string;
  technicianName?: string;
  isPlatformAdmin?: boolean;
}

/** Cookie + seal last ~400 days; we refresh on /api/auth/me so daily use never expires. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 400;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-min-32-characters!!",
  cookieName: "service_erp_session",
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS - 60,
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Rewrite the cookie so expiry rolls forward while they keep using the app. */
export async function touchSession(
  session: Awaited<ReturnType<typeof getSession>>
) {
  if (!session.isLoggedIn) return;
  await session.save();
}

export function isDeviceApproved(session: SessionData): boolean {
  return session.deviceStatus === "approved";
}

export async function clearSession(session: Awaited<ReturnType<typeof getSession>>) {
  session.role = "reception";
  session.isLoggedIn = false;
  session.tenantId = undefined;
  session.tenantSlug = undefined;
  session.tenantName = undefined;
  session.jobPrefix = undefined;
  session.staffUserId = undefined;
  session.staffName = undefined;
  session.deviceId = undefined;
  session.deviceStatus = undefined;
  session.technicianId = undefined;
  session.technicianName = undefined;
  session.isPlatformAdmin = undefined;
  await session.save();
}
