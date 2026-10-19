import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { countPendingDevices } from "@/lib/staff-auth";
import { countUnreadAlerts } from "@/lib/staff-alerts";
import {
  clearSession,
  getSession,
  isDeviceApproved,
} from "@/lib/session";

const LAST_SEEN_MIN_MS = 5 * 60 * 1000;
const lastSeenTouchedAt = new Map<string, number>();

function maybeTouchLastSeen(
  tenantId: string,
  staffUserId: string,
  deviceId: string
) {
  const key = `${tenantId}:${staffUserId}:${deviceId}`;
  const now = Date.now();
  const prev = lastSeenTouchedAt.get(key) ?? 0;
  if (now - prev < LAST_SEEN_MIN_MS) return false;
  lastSeenTouchedAt.set(key, now);
  return true;
}

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.staffUserId) {
    return NextResponse.json({ isLoggedIn: false });
  }

  const payload: Record<string, unknown> = {
    isLoggedIn: true,
    role: session.role,
    staffName: session.staffName ?? null,
    staffUserId: session.staffUserId,
    tenantId: session.tenantId ?? null,
    tenantName: session.tenantName ?? null,
    deviceStatus: session.deviceStatus ?? "pending",
    deviceApproved: isDeviceApproved(session),
    technicianId: session.technicianId ?? null,
    technicianName: session.technicianName ?? null,
    pendingDeviceCount: 0,
    unreadAlertCount: 0,
  };

  const sessionComplete = Boolean(
    session.tenantId && session.staffName && session.deviceStatus
  );

  if (sessionComplete && isDeviceApproved(session)) {
    const staffUserId = session.staffUserId;
    const tenantId = session.tenantId;
    const deviceId = session.deviceId;
    const role = session.role;

    if (tenantId) {
      try {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { status: true },
        });
        if (tenant && tenant.status !== "active") {
          await clearSession(session);
          return NextResponse.json({
            isLoggedIn: false,
            error: "shop_locked",
          });
        }
      } catch {
        /* keep session if shop status cannot be checked */
      }
    }

    if (deviceId && tenantId && maybeTouchLastSeen(tenantId, staffUserId, deviceId)) {
      after(async () => {
        try {
          await prisma.staffDevice.updateMany({
            where: { tenantId, staffUserId, deviceId, status: "approved" },
            data: { lastSeenAt: new Date() },
          });
        } catch {
          /* non-blocking */
        }
      });
    }

    if (role === "admin" && tenantId) {
      payload.pendingDeviceCount = await countPendingDevices(tenantId);
    }
    if ((role === "verifier" || role === "admin") && tenantId) {
      payload.unreadAlertCount = await countUnreadAlerts(tenantId, role);
    }

    return NextResponse.json(payload);
  }

  const staffUser = await prisma.staffUser.findUnique({
    where: { id: session.staffUserId },
    include: {
      technician: true,
      tenant: { select: { name: true, status: true } },
    },
  });

  if (!staffUser || !staffUser.active) {
    await clearSession(session);
    return NextResponse.json({ isLoggedIn: false });
  }

  if (!staffUser.tenant || staffUser.tenant.status !== "active") {
    await clearSession(session);
    return NextResponse.json({
      isLoggedIn: false,
      error: "shop_locked",
    });
  }

  if (session.tenantId && staffUser.tenantId !== session.tenantId) {
    await clearSession(session);
    return NextResponse.json({ isLoggedIn: false });
  }

  let sessionDirty = false;

  if (!session.tenantId) {
    session.tenantId = staffUser.tenantId;
    sessionDirty = true;
  }

  if (session.deviceId) {
    const device = await prisma.staffDevice.findFirst({
      where: {
        tenantId: staffUser.tenantId,
        staffUserId: session.staffUserId,
        deviceId: session.deviceId,
      },
      select: { id: true, status: true },
    });

    if (!device || device.status === "revoked") {
      await clearSession(session);
      return NextResponse.json({
        isLoggedIn: false,
        error: "device_revoked",
      });
    }

    const nextStatus =
      session.role === "admin" && device.status === "pending"
        ? "approved"
        : device.status;

    if (session.role === "admin" && device.status === "pending") {
      await prisma.staffDevice.update({
        where: { id: device.id },
        data: {
          status: "approved",
          approvedAt: new Date(),
          approvedById: session.staffUserId,
        },
      });
    }

    if (session.deviceStatus !== nextStatus) {
      session.deviceStatus = nextStatus;
      sessionDirty = true;
    }
  }

  if (sessionDirty) {
    await session.save();
  }

  payload.staffName = staffUser.name;
  payload.tenantId = staffUser.tenantId;
  payload.tenantName = staffUser.tenant?.name ?? session.tenantName ?? null;
  payload.deviceStatus = session.deviceStatus ?? "pending";
  payload.deviceApproved = isDeviceApproved(session);
  payload.technicianId = session.technicianId ?? staffUser.technicianId;
  payload.technicianName =
    session.technicianName ?? staffUser.technician?.name ?? null;

  if (session.role === "admin" && isDeviceApproved(session)) {
    payload.pendingDeviceCount = await countPendingDevices(staffUser.tenantId);
  }

  if (
    (session.role === "verifier" || session.role === "admin") &&
    isDeviceApproved(session)
  ) {
    payload.unreadAlertCount = await countUnreadAlerts(
      staffUser.tenantId,
      session.role
    );
  }

  return NextResponse.json(payload);
}
