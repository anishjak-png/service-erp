import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { JobStatus } from "@prisma/client";
import { isServiceKind } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { resolveBillSplit } from "@/lib/currency";
import { getJobPatchSelect } from "@/lib/job-selects";
import {
  accessoryNames,
  staffActorName,
  parseAccessories,
  parseOptionalDateInput,
  serializeAccessories,
} from "@/lib/jobs";
import { validateAccessoriesForAppliance } from "@/lib/lookups";
import {
  canDeliverJob,
  canEditCompletedBy,
  canEditDeliveredJob,
  canEditServiceAmount,
  canReopenDeliveredJob,
  isServiceAmountLocked,
} from "@/lib/auth";
import {
  canEditRack,
  canMarkJobCompleted,
  canMarkJobReady,
} from "@/lib/roles";
import { createJobCompletedAlerts } from "@/lib/staff-alerts";
import { getSession } from "@/lib/session";
import { tenantWhere } from "@/lib/tenant";
import { dispatchNotificationEventAsync } from "@/lib/notifications/events";
import { enqueueJobDeliveryPrint } from "@/lib/print-queue";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantFilter = tenantWhere(session);
  const { id } = await context.params;

  const job = await prisma.jobCard.findFirst({
    where: { ...tenantFilter, OR: [{ id }, { jobNumber: id }] },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          mobile: true,
          address: true,
          allowWhatsappNotifications: true,
        },
      },
      assignedTechnician: { select: { id: true, name: true } },
      completedByTechnician: { select: { id: true, name: true } },
      outsourcedTo: { select: { id: true, name: true } },
      completedByOutsource: { select: { id: true, name: true } },
      statusHistory: {
        orderBy: { changedAt: "desc" },
        take: 40,
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantFilter = tenantWhere(session);

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.jobCard.findFirst({
      where: { ...tenantFilter, OR: [{ id }, { jobNumber: id }] },
    });

    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (existing.status === "Delivered" && !canEditDeliveredJob(session.role)) {
      return NextResponse.json(
        { error: "Delivered jobs cannot be edited. Contact admin to reopen." },
        { status: 403 }
      );
    }

    const amountLocked = isServiceAmountLocked(existing);

    if (
      (body.serviceAmount !== undefined ||
        body.serviceCharge !== undefined ||
        body.sparesAmount !== undefined) &&
      !body.status &&
      !canEditServiceAmount(session.role)
    ) {
      return NextResponse.json(
        { error: "Only admin can edit service amount after the job is completed" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    const changedBy = staffActorName(session);

    let statusChange: JobStatus | null = null;
    let statusNote: string | undefined;

    if (body.status) {
      const newStatus = body.status as JobStatus;
      const fromOutsourced = existing.status === "Outsourced";
      const fromWarranty =
        existing.status === "WarrantyPending" ||
        existing.status === "WarrantyWithCompany";

      if (existing.status === "Delivered" && newStatus !== "Delivered") {
        if (!canReopenDeliveredJob(session.role)) {
          return NextResponse.json(
            { error: "Only admin can reopen delivered jobs" },
            { status: 403 }
          );
        }
        data.deliveredAt = null;
      }

      if (newStatus === "Delivered" && !canDeliverJob(session.role)) {
        return NextResponse.json(
          { error: "Technicians cannot mark jobs as delivered" },
          { status: 403 }
        );
      }

      if (
        newStatus === "Delivered" &&
        existing.status !== "Ready" &&
        existing.status !== "Return"
      ) {
        return NextResponse.json(
          {
            error:
              "Only Ready or Return jobs can be marked as delivered",
          },
          { status: 400 }
        );
      }

      if (newStatus === "WarrantyWithCompany") {
        if (!existing.isWarranty && body.convertToWarranty !== true) {
          return NextResponse.json(
            { error: "Only warranty jobs can be sent with company" },
            { status: 400 }
          );
        }
        data.status = "WarrantyWithCompany";
        data.isWarranty = true;
        data.warrantyTakenAt = new Date();
        data.assignedTechnicianId = null;
        data.outsourcedToId = null;
        data.outsourcedAt = null;
        statusChange = "WarrantyWithCompany";
        statusNote =
          body.note ??
          `Product taken by ${existing.brand} for warranty service`;
      } else if (newStatus === "WarrantyPending") {
        const converting = !existing.isWarranty;
        data.status = "WarrantyPending";
        data.isWarranty = true;
        data.warrantyTakenAt = null;
        data.assignedTechnicianId = null;
        data.outsourcedToId = null;
        data.outsourcedAt = null;
        statusChange = "WarrantyPending";
        statusNote = converting
          ? body.note ??
            `Converted to warranty by ${changedBy} — ${existing.brand}`
          : body.note ??
            `Back at store — waiting for ${existing.brand} warranty visit`;
      } else if (newStatus === "Outsourced") {
        const outsourcedToId = body.outsourcedToId;
        if (!outsourcedToId || typeof outsourcedToId !== "string") {
          return NextResponse.json(
            { error: "Select an outsource partner" },
            { status: 400 }
          );
        }
        const partner = await prisma.outsourcePartner.findFirst({
          where: { ...tenantFilter, id: outsourcedToId, active: true },
        });
        if (!partner) {
          return NextResponse.json(
            { error: "Invalid outsource partner" },
            { status: 400 }
          );
        }
        data.status = "Outsourced";
        data.outsourcedToId = partner.id;
        data.outsourcedAt = new Date();
        data.assignedTechnicianId = null;
        statusChange = "Outsourced";
        statusNote = body.note ?? `Sent to ${partner.name}`;
      } else if (newStatus === "JobCompleted") {
        if (!canMarkJobCompleted(session.role)) {
          return NextResponse.json(
            { error: "Not allowed to mark job completed" },
            { status: 403 }
          );
        }
        if (amountLocked && !canEditServiceAmount(session.role)) {
          if (existing.serviceAmount == null) {
            return NextResponse.json(
              { error: "Service amount is required when marking job completed" },
              { status: 400 }
            );
          }
        } else {
          const parsed =
            body.serviceCharge !== undefined ||
            body.sparesAmount !== undefined ||
            body.serviceAmount !== undefined
              ? resolveBillSplit(body)
              : { serviceCharge: 0, sparesAmount: 0, serviceAmount: 0 };
          if (!parsed) {
            return NextResponse.json(
              { error: "Invalid service or spares amount" },
              { status: 400 }
            );
          }
          if (body.serviceCharge === undefined || body.serviceCharge === "") {
            return NextResponse.json(
              { error: "Service charge is required" },
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
        }
        if (!existing.completedAt) {
          data.completedAt = new Date();
        }

        if (fromOutsourced && existing.outsourcedToId) {
          data.completedByOutsourceId = existing.outsourcedToId;
          data.outsourcedToId = null;
          data.outsourcedAt = null;
          const partner = await prisma.outsourcePartner.findFirst({
            where: { ...tenantFilter, id: existing.outsourcedToId },
          });
          statusNote =
            body.note ??
            `Received from ${partner?.name ?? "outsource partner"} — Job completed`;
        } else if (fromWarranty) {
          data.warrantyTakenAt = null;
          statusNote =
            body.note ?? `Warranty completed by ${existing.brand}`;
        } else {
          const completedById =
            typeof body.completedByTechnicianId === "string" &&
            body.completedByTechnicianId
              ? body.completedByTechnicianId
              : session.role === "technician"
                ? session.technicianId
                : existing.completedByTechnicianId;
          if (!completedById || typeof completedById !== "string") {
            return NextResponse.json(
              { error: "Select the technician who completed the repair" },
              { status: 400 }
            );
          }
          const technician = await prisma.technician.findFirst({
            where: { ...tenantFilter, id: completedById, active: true },
          });
          if (!technician) {
            return NextResponse.json(
              { error: "Invalid technician selected" },
              { status: 400 }
            );
          }
          data.completedByTechnicianId = completedById;
        }

        data.status = "JobCompleted";
        statusChange = "JobCompleted";
        if (!statusNote) statusNote = body.note ?? undefined;
      } else if (newStatus === "Ready") {
        if (!canMarkJobReady(session.role)) {
          return NextResponse.json(
            { error: "Only verifier or admin can mark a job Ready" },
            { status: 403 }
          );
        }
        const rack =
          typeof body.rackDetail === "string"
            ? body.rackDetail.trim()
            : existing.rackDetail?.trim() ?? "";
        if (!rack) {
          return NextResponse.json(
            { error: "Enter the rack before marking Ready" },
            { status: 400 }
          );
        }
        data.rackDetail = rack;
        if (!existing.readyAt) {
          data.readyAt = new Date();
        }
        data.status = "Ready";
        statusChange = "Ready";
        data.deliveryContactStatus = "not_contacted";
        data.expectedDeliveryAt = null;
        statusNote = body.note ?? "Verified and marked Ready";
      } else if (newStatus === "Return") {
        const returnNote =
          typeof body.note === "string" ? body.note.trim() : "";
        if (!returnNote) {
          return NextResponse.json(
            { error: "Return note is required" },
            { status: 400 }
          );
        }

        data.serviceAmount = 0;
        data.serviceCharge = 0;
        data.sparesAmount = 0;
        data.status = "Return";
        statusChange = "Return";

        if (fromOutsourced && existing.outsourcedToId) {
          data.completedByOutsourceId = existing.outsourcedToId;
          data.outsourcedToId = null;
          data.outsourcedAt = null;
          const partner = await prisma.outsourcePartner.findFirst({
            where: { ...tenantFilter, id: existing.outsourcedToId },
          });
          statusNote = `${returnNote} · Received from ${partner?.name ?? "outsource partner"}`;
        } else if (fromWarranty) {
          data.warrantyTakenAt = null;
          statusNote = `${returnNote} · Warranty return by ${existing.brand}`;
        } else {
          statusNote = returnNote;
        }
      } else {
        data.status = newStatus;
        statusChange = newStatus;
        statusNote = body.note ?? undefined;
        data.outsourcedToId = null;
        data.outsourcedAt = null;
      }

      if (newStatus === "Delivered") {
        data.deliveredAt = new Date();
      }
    }

    if (
      (body.serviceAmount !== undefined ||
        body.serviceCharge !== undefined ||
        body.sparesAmount !== undefined) &&
      !body.status &&
      canEditServiceAmount(session.role)
    ) {
      const parsed = resolveBillSplit(body);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid service or spares amount" },
          { status: 400 }
        );
      }
      if (body.serviceCharge === undefined || body.serviceCharge === "") {
        return NextResponse.json(
          { error: "Service charge is required" },
          { status: 400 }
        );
      }
      data.serviceCharge = parsed.serviceCharge;
      data.sparesAmount = parsed.sparesAmount;
      data.serviceAmount = parsed.serviceAmount;
      if (isServiceKind(body.serviceKind)) {
        data.serviceKind = body.serviceKind;
      } else if (!isServiceKind(existing.serviceKind)) {
        return NextResponse.json(
          { error: "Select minor or major service" },
          { status: 400 }
        );
      }
    }

    if (body.rackDetail !== undefined) {
      if (!canEditRack(session.role)) {
        return NextResponse.json(
          { error: "Not allowed to edit rack details" },
          { status: 403 }
        );
      }
      const rack =
        typeof body.rackDetail === "string" ? body.rackDetail.trim() : "";
      data.rackDetail = rack || null;
    }

    if (body.remarks != null) {
      data.remarks = body.remarks;
    }

    if (body.warrantyPurchaseDate !== undefined) {
      if (session.role === "technician") {
        return NextResponse.json(
          { error: "Not allowed to edit warranty purchase date" },
          { status: 403 }
        );
      }
      const becomingWarranty =
        Boolean(data.isWarranty) ||
        existing.isWarranty ||
        body.status === "WarrantyPending" ||
        body.status === "WarrantyWithCompany";
      if (!becomingWarranty) {
        return NextResponse.json(
          { error: "Purchase date applies only to warranty jobs" },
          { status: 400 }
        );
      }
      const purchaseDate = parseOptionalDateInput(body.warrantyPurchaseDate);
      if (purchaseDate === undefined) {
        return NextResponse.json(
          { error: "Invalid purchase date" },
          { status: 400 }
        );
      }
      data.warrantyPurchaseDate = purchaseDate;
    }

    if (body.assignedTechnicianId != null && session.role !== "technician") {
      data.assignedTechnicianId = body.assignedTechnicianId || null;
    }

    if (body.completedByTechnicianId !== undefined) {
      if (!canEditCompletedBy(session.role)) {
        return NextResponse.json(
          { error: "Only admin can change completed by technician" },
          { status: 403 }
        );
      }
      data.completedByTechnicianId = body.completedByTechnicianId || null;
    }

    if (body.whatsappNotificationsOverride !== undefined) {
      if (session.role !== "reception" && session.role !== "admin") {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
      if (body.whatsappNotificationsOverride === null) {
        data.whatsappNotificationsOverride = null;
      } else {
        data.whatsappNotificationsOverride = Boolean(
          body.whatsappNotificationsOverride
        );
      }
    }

    if (body.accessories !== undefined && existing.status !== "Delivered") {
      const list = parseAccessories(
        typeof body.accessories === "string"
          ? body.accessories
          : JSON.stringify(body.accessories)
      );
      const valid = await validateAccessoriesForAppliance(
        existing.applianceType,
        accessoryNames(list)
      );
      if (!valid) {
        return NextResponse.json(
          { error: "One or more accessories are not allowed for this product" },
          { status: 400 }
        );
      }
      data.accessories = serializeAccessories(list);
    }

    const jobId = existing.id;

    if (statusChange) {
      const [statusHistoryEntry, job] = await prisma.$transaction([
        prisma.statusHistory.create({
          data: {
            jobCardId: jobId,
            status: statusChange,
            changedBy,
            note: statusNote,
          },
        }),
        prisma.jobCard.update({
          where: { id: jobId },
          data,
          select: getJobPatchSelect(),
        }),
      ]);

      if (statusChange === "JobCompleted") {
        after(async () => {
          await createJobCompletedAlerts({
            tenantId: existing.tenantId,
            jobId,
            jobNumber: existing.jobNumber,
          });
        });
      }
      if (statusChange === "Ready" && !existing.readyAt) {
        after(async () => {
          await dispatchNotificationEventAsync({ type: "JOB_READY", jobId });
        });
      }
      if (statusChange === "Return") {
        after(async () => {
          await dispatchNotificationEventAsync({ type: "JOB_RETURN", jobId });
        });
      }
      if (statusChange === "Delivered") {
        after(async () => {
          try {
            await enqueueJobDeliveryPrint(jobId, { tenantId: existing.tenantId });
          } catch (error) {
            console.error("[job-deliver] print enqueue failed", error);
          }
        });
      }

      return NextResponse.json({ ...job, statusHistoryEntry });
    }

    const job = await prisma.jobCard.update({
      where: { id: jobId },
      data,
      select: getJobPatchSelect(),
    });

    return NextResponse.json(job);
  } catch (error) {
    console.error("PATCH /api/jobs/[id] failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
