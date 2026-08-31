import { NextRequest, NextResponse } from "next/server";
import { TokenStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveBillSplit } from "@/lib/currency";
import { isServiceKind } from "@/lib/constants";
import { canDeliverJob } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { tenantWhere } from "@/lib/tenant";
import {
  enqueueTokenDeliveryPrint,
  enqueueTokenReceiptPrint,
} from "@/lib/print-queue";

type RouteContext = { params: Promise<{ id: string }> };

const TOKEN_STATUSES: TokenStatus[] = [
  "Pending",
  "JobCompleted",
  "Ready",
  "Delivered",
];

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const token = await prisma.tokenCard.findFirst({
    where: { ...tenantWhere(session), OR: [{ id }, { tokenNumber: id }] },
    include: {
      customer: true,
      assignedTechnician: true,
      completedByTechnician: true,
    },
  });
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json(token);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantFilter = tenantWhere(session);
  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.tokenCard.findFirst({
    where: { ...tenantFilter, OR: [{ id }, { tokenNumber: id }] },
  });
  if (!existing) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.status) {
    const next = body.status as TokenStatus;
    if (!TOKEN_STATUSES.includes(next)) {
      return NextResponse.json({ error: "Invalid token status" }, { status: 400 });
    }
    if (next === "Delivered" && !canDeliverJob(session.role)) {
      return NextResponse.json({ error: "Not allowed to deliver" }, { status: 403 });
    }
    if (next === "Delivered" && existing.status !== "Ready") {
      return NextResponse.json(
        { error: "Only Ready tokens can be delivered" },
        { status: 400 }
      );
    }
    if (next === "JobCompleted") {
      if (body.serviceCharge === undefined || body.serviceCharge === "") {
        return NextResponse.json(
          { error: "Service charge is required" },
          { status: 400 }
        );
      }
      const parsed = resolveBillSplit(body);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid service or spares amount" },
          { status: 400 }
        );
      }
      if (!isServiceKind(body.serviceKind) && !isServiceKind(existing.serviceKind)) {
        return NextResponse.json(
          { error: "Select minor or major service" },
          { status: 400 }
        );
      }
      data.serviceCharge = parsed.serviceCharge;
      data.sparesAmount = parsed.sparesAmount;
      data.serviceAmount = parsed.serviceAmount;
      if (isServiceKind(body.serviceKind)) {
        data.serviceKind = body.serviceKind;
      }
      data.completedAt = existing.completedAt ?? new Date();
      data.completedByTechnicianId =
        body.completedByTechnicianId ||
        session.technicianId ||
        existing.completedByTechnicianId ||
        existing.assignedTechnicianId;
    }
    if (next === "Ready") {
      data.readyAt = existing.readyAt ?? new Date();
    }
    if (next === "Delivered") {
      data.deliveredAt = new Date();
    }
    data.status = next;
  }

  if (body.remarks !== undefined) {
    data.remarks = String(body.remarks ?? "").trim() || null;
  }

  const token = await prisma.tokenCard.update({
    where: { id: existing.id },
    data,
    include: {
      customer: true,
      assignedTechnician: true,
      completedByTechnician: true,
    },
  });

  if (body.reprint === true) {
    await enqueueTokenReceiptPrint(token.id, {
      reprint: true,
      tenantId: token.tenantId,
    });
  }

  if (body.status === "Delivered") {
    try {
      await enqueueTokenDeliveryPrint(token.id, { tenantId: token.tenantId });
    } catch (error) {
      console.error("[token-deliver] print enqueue failed", error);
    }
  }

  return NextResponse.json(token);
}
