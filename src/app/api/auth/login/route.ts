import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isValidMobile,
  normalizeMobile,
  verifyPassword,
} from "@/lib/password";
import {
  countApprovedDevices,
  revokeOtherApprovedDevices,
  staffRoleToSessionRole,
  upsertStaffDevice,
} from "@/lib/staff-auth";
import { getSession } from "@/lib/session";
import { getTenantBySlug, resolveTenantSlugFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const mobileRaw = body.mobile;
  const password = body.password;
  const deviceId = body.deviceId;
  const deviceLabel = body.deviceLabel;
  const platform = body.platform === "android" ? "android" : "web";
  const bodyTenantSlug =
    typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : "";

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
  const tenantSlug =
    bodyTenantSlug ||
    resolveTenantSlugFromRequest({
      host: request.headers.get("host"),
      searchParams: request.nextUrl.searchParams,
      headerSlug: request.headers.get("x-tenant-slug"),
    });

  let staffUser = null;

  if (tenantSlug) {
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant || tenant.status !== "active") {
      return NextResponse.json(
        { error: "Shop not found or suspended" },
        { status: 404 }
      );
    }
    staffUser = await prisma.staffUser.findUnique({
      where: {
        tenantId_mobile: { tenantId: tenant.id, mobile },
      },
      include: { technician: true, tenant: true },
    });
  } else {
    const matches = await prisma.staffUser.findMany({
      where: { mobile, active: true },
      include: { technician: true, tenant: true },
      take: 2,
    });
    if (matches.length > 1) {
      return NextResponse.json(
        {
          error:
            "Multiple shops found for this mobile — open via ?tenant=slug or subdomain",
        },
        { status: 400 }
      );
    }
    staffUser = matches[0] ?? null;
  }

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

  const approvedCount = await countApprovedDevices(staffUser.tenantId);
  const autoApprove =
    staffUser.role === "admin" && approvedCount === 0;

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
