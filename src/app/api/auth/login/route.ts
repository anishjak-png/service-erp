import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isValidMobile,
  normalizeMobile,
  verifyPassword,
} from "@/lib/password";
import {
  revokeOtherApprovedDevices,
  staffRoleToSessionRole,
  upsertStaffDevice,
} from "@/lib/staff-auth";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    return await handleLogin(request);
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    const message = err instanceof Error ? err.message : "Sign-in failed";
    const dbDown =
      /can't reach database|P1001|P1017|ENOTFOUND|authentication failed/i.test(
        message
      );
    return NextResponse.json(
      {
        error: dbDown
          ? "Database unavailable. Check Vercel DATABASE_URL."
          : "Sign-in failed. Please try again.",
      },
      { status: 503 }
    );
  }
}

async function handleLogin(request: NextRequest) {
  const body = await request.json();
  const mobileRaw = body.mobile;
  const password = body.password;
  const deviceId = body.deviceId;
  const deviceLabel = body.deviceLabel;
  const platform = body.platform === "android" ? "android" : "web";

  if (
    !mobileRaw ||
    typeof mobileRaw !== "string" ||
    !password ||
    typeof password !== "string" ||
    !deviceId ||
    typeof deviceId !== "string"
  ) {
    return NextResponse.json(
      { error: "Mobile, password, and device ID are required" },
      { status: 400 }
    );
  }

  if (!isValidMobile(mobileRaw)) {
    return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
  }

  const mobile = normalizeMobile(mobileRaw);

  const staffUser = await prisma.staffUser.findUnique({
    where: { mobile },
    include: { technician: true, tenant: true },
  });

  if (!staffUser || !staffUser.active) {
    return NextResponse.json(
      { error: "Invalid mobile or password" },
      { status: 401 }
    );
  }

  if (!staffUser.tenantId || !staffUser.tenant) {
    return NextResponse.json(
      { error: "Staff account is not linked to a shop" },
      { status: 403 }
    );
  }

  if (staffUser.tenant.status !== "active") {
    return NextResponse.json(
      { error: "Shop is suspended" },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(password, staffUser.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid mobile or password" },
      { status: 401 }
    );
  }

  const approvedForThisAdmin = await prisma.staffDevice.count({
    where: {
      staffUserId: staffUser.id,
      status: "approved",
    },
  });
  const autoApprove =
    staffUser.role === "admin" && approvedForThisAdmin === 0;

  const device = await upsertStaffDevice({
    tenantId: staffUser.tenantId,
    staffUserId: staffUser.id,
    deviceId: deviceId.trim(),
    deviceLabel: typeof deviceLabel === "string" ? deviceLabel : null,
    platform,
    autoApprove,
    approvedById: autoApprove ? staffUser.id : undefined,
  });

  if (staffUser.role !== "admin" && device.status !== "revoked") {
    await revokeOtherApprovedDevices(staffUser.id, device.deviceId);
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.staffUserId = staffUser.id;
  session.staffName = staffUser.name;
  session.role = staffRoleToSessionRole(staffUser.role);
  session.deviceId = device.deviceId;
  session.deviceStatus = device.status;
  session.tenantId = staffUser.tenantId;
  session.tenantSlug = staffUser.tenant.slug;
  session.tenantName = staffUser.tenant.name;
  session.isPlatformAdmin = false;

  if (staffUser.role === "technician" && staffUser.technician) {
    session.technicianId = staffUser.technician.id;
    session.technicianName = staffUser.technician.name;
  } else {
    session.technicianId = undefined;
    session.technicianName = undefined;
  }

  await session.save();

  if (device.status === "pending") {
    return NextResponse.json(
      {
        error: "device_pending",
        deviceStatus: "pending",
        staffName: staffUser.name,
        role: session.role,
        tenantSlug: session.tenantSlug,
      },
      { status: 403 }
    );
  }

  if (device.status === "revoked") {
    return NextResponse.json(
      { error: "device_revoked", deviceStatus: "revoked" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    role: session.role,
    staffName: staffUser.name,
    deviceStatus: device.status,
    technicianId: session.technicianId,
    technicianName: session.technicianName,
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
    tenantName: session.tenantName,
  });
}
