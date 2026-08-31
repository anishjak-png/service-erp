import { NextRequest, NextResponse } from "next/server";
import { TokenStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canCreateToken } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { requireTenantId, tenantWhere } from "@/lib/tenant";
import {
  accessoryNames,
  normalizeMobile,
  parseAccessories,
  serializeAccessories,
  staffActorName,
} from "@/lib/jobs";
import { generateTokenNumber } from "@/lib/tokens";
import {
  getDefaultTechnicianForAppliance,
  isBrandAllowedForAppliance,
  isComplaintAllowedForAppliance,
  validateAccessoriesForAppliance,
} from "@/lib/lookups";
import { enqueueTokenReceiptPrint } from "@/lib/print-queue";

const TOKEN_SELECT = {
  id: true,
  tokenNumber: true,
  status: true,
  applianceType: true,
  brand: true,
  model: true,
  complaint: true,
  estimatedMinutes: true,
  receivedAt: true,
  completedAt: true,
  readyAt: true,
  deliveredAt: true,
  remarks: true,
  serviceAmount: true,
  serviceCharge: true,
  serviceKind: true,
  sparesAmount: true,
  customer: { select: { id: true, mobile: true, name: true } },
  assignedTechnician: { select: { id: true, name: true } },
  completedByTechnician: { select: { id: true, name: true } },
} as const;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantFilter = tenantWhere(session);
  const scope = request.nextUrl.searchParams.get("scope");
  const status = request.nextUrl.searchParams.get("status");

  const where: Record<string, unknown> = { ...tenantFilter };
  if (
    session.role === "technician" &&
    session.technicianId &&
    scope !== "all"
  ) {
    where.assignedTechnicianId = session.technicianId;
  }
  if (status && status !== "all") {
    where.status = status as TokenStatus;
  } else {
    where.status = { not: "Delivered" };
  }

  const tokens = await prisma.tokenCard.findMany({
    where,
    select: TOKEN_SELECT,
    orderBy: { receivedAt: "asc" },
    take: 200,
  });
  return NextResponse.json(tokens);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.role || !canCreateToken(session.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const tenantId = requireTenantId(session);
  const body = await request.json();

  const mobile = String(body.mobile ?? "");
  const customerName = String(body.customerName ?? "");
  const applianceType = String(body.applianceType ?? "").trim();
  const brand = String(body.brand ?? "").trim();
  const complaint = String(body.complaint ?? "").trim();
  const estimatedMinutes = Number(body.estimatedMinutes);

  if (!normalizeMobile(mobile) || normalizeMobile(mobile).length !== 10) {
    return NextResponse.json({ error: "Valid mobile required" }, { status: 400 });
  }
  if (!applianceType || !brand || !complaint) {
    return NextResponse.json(
      { error: "Product, brand, and complaint are required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 1) {
    return NextResponse.json(
      { error: "Select an estimated time" },
      { status: 400 }
    );
  }

  const [brandOk, complaintOk] = await Promise.all([
    isBrandAllowedForAppliance(applianceType, brand, tenantId),
    isComplaintAllowedForAppliance(applianceType, complaint, tenantId),
  ]);
  if (!brandOk) {
    return NextResponse.json({ error: "Brand not allowed for this product" }, { status: 400 });
  }
  if (!complaintOk) {
    return NextResponse.json(
      { error: "Complaint not allowed for this product" },
      { status: 400 }
    );
  }

  const accessoriesList = parseAccessories(
    typeof body.accessories === "string"
      ? body.accessories
      : JSON.stringify(body.accessories ?? [])
  );
  if (accessoriesList.length > 0) {
    const ok = await validateAccessoriesForAppliance(
      applianceType,
      accessoryNames(accessoriesList),
      tenantId
    );
    if (!ok) {
      return NextResponse.json(
        { error: "One or more accessories are not allowed" },
        { status: 400 }
      );
    }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tokenPrefix: true, tokenResetDaily: true },
  });
  const normalizedMobile = normalizeMobile(mobile);
  const creatorName = staffActorName(session);

  const [customer, tokenNumber, defaultTech] = await Promise.all([
    prisma.customer.upsert({
      where: { tenantId_mobile: { tenantId, mobile: normalizedMobile } },
      update: { name: customerName.trim() || undefined },
      create: {
        tenantId,
        mobile: normalizedMobile,
        name: customerName.trim() || null,
      },
    }),
    generateTokenNumber(
      tenantId,
      tenant?.tokenPrefix,
      Boolean(tenant?.tokenResetDaily)
    ),
    getDefaultTechnicianForAppliance(applianceType, tenantId),
  ]);

  const token = await prisma.tokenCard.create({
    data: {
      tenantId,
      tokenNumber,
      customerId: customer.id,
      applianceType,
      brand,
      model: String(body.model ?? "").trim() || null,
      complaint,
      physicalCondition: String(body.physicalCondition ?? "").trim() || null,
      accessories: serializeAccessories(accessoriesList),
      remarks: String(body.remarks ?? "").trim() || null,
      estimatedMinutes,
      assignedTechnicianId: defaultTech?.id ?? null,
      createdBy: creatorName,
    },
    select: TOKEN_SELECT,
  });

  try {
    await enqueueTokenReceiptPrint(token.id, { tenantId });
  } catch (error) {
    console.error("[token-create] print enqueue failed", error);
  }

  return NextResponse.json(token, { status: 201 });
}
