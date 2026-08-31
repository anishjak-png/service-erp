import { PrintJobStatus } from "@prisma/client";
import { prisma } from "./db";
import { resolvePrinterId } from "./printers";

const DEFAULT_BRANCH_ID = process.env.PRINT_BRANCH_ID?.trim() || "main";

export async function enqueueReceiptPrint(
  jobCardId: string,
  options?: { reprint?: boolean; tenantId?: string }
) {
  const reprint = options?.reprint ?? false;

  let tenantId = options?.tenantId;
  if (!tenantId) {
    const job = await prisma.jobCard.findUnique({
      where: { id: jobCardId },
      select: { tenantId: true },
    });
    if (!job) throw new Error("Job not found for print");
    tenantId = job.tenantId;
  }

  if (reprint) {
    await prisma.printJob.updateMany({
      where: {
        tenantId,
        jobCardId,
        type: "receipt",
        status: { in: ["Pending", "Printing"] },
      },
      data: {
        status: "Failed",
        errorMessage: "Superseded by new print request",
      },
    });
  } else {
    const existing = await prisma.printJob.findFirst({
      where: {
        tenantId,
        jobCardId,
        type: "receipt",
        status: { in: ["Pending", "Printing"] },
      },
      select: { id: true },
    });

    if (existing) {
      return prisma.printJob.findUniqueOrThrow({ where: { id: existing.id } });
    }
  }

  const printerId = await resolvePrinterId(tenantId, "job_new");

  return prisma.printJob.create({
    data: {
      tenantId,
      jobCardId,
      type: "receipt",
      status: "Pending",
      branchId: DEFAULT_BRANCH_ID,
      printerId,
    },
  });
}

export async function enqueueTokenReceiptPrint(
  tokenCardId: string,
  options?: { reprint?: boolean; tenantId?: string }
) {
  const reprint = options?.reprint ?? false;

  let tenantId = options?.tenantId;
  if (!tenantId) {
    const token = await prisma.tokenCard.findUnique({
      where: { id: tokenCardId },
      select: { tenantId: true },
    });
    if (!token) throw new Error("Token not found for print");
    tenantId = token.tenantId;
  }

  if (reprint) {
    await prisma.printJob.updateMany({
      where: {
        tenantId,
        tokenCardId,
        type: "token_receipt",
        status: { in: ["Pending", "Printing"] },
      },
      data: {
        status: "Failed",
        errorMessage: "Superseded by new print request",
      },
    });
  }

  const printerId = await resolvePrinterId(tenantId, "token_new");

  return prisma.printJob.create({
    data: {
      tenantId,
      tokenCardId,
      type: "token_receipt",
      status: "Pending",
      branchId: DEFAULT_BRANCH_ID,
      printerId,
    },
  });
}

export async function enqueueJobDeliveryPrint(
  jobCardId: string,
  options?: { tenantId?: string }
) {
  let tenantId = options?.tenantId;
  if (!tenantId) {
    const job = await prisma.jobCard.findUnique({
      where: { id: jobCardId },
      select: { tenantId: true },
    });
    if (!job) throw new Error("Job not found for print");
    tenantId = job.tenantId;
  }
  const printerId = await resolvePrinterId(tenantId, "job_delivery");
  return prisma.printJob.create({
    data: {
      tenantId,
      jobCardId,
      type: "receipt",
      status: "Pending",
      branchId: DEFAULT_BRANCH_ID,
      printerId,
    },
  });
}

export async function enqueueTokenDeliveryPrint(
  tokenCardId: string,
  options?: { tenantId?: string }
) {
  let tenantId = options?.tenantId;
  if (!tenantId) {
    const token = await prisma.tokenCard.findUnique({
      where: { id: tokenCardId },
      select: { tenantId: true },
    });
    if (!token) throw new Error("Token not found for print");
    tenantId = token.tenantId;
  }
  const printerId = await resolvePrinterId(tenantId, "token_delivery");
  return prisma.printJob.create({
    data: {
      tenantId,
      tokenCardId,
      type: "token_receipt",
      status: "Pending",
      branchId: DEFAULT_BRANCH_ID,
      printerId,
    },
  });
}

export async function getLatestPrintStatus(jobCardId: string, tenantId?: string) {
  return prisma.printJob.findFirst({
    where: {
      jobCardId,
      type: "receipt",
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      attempts: true,
      errorMessage: true,
      createdAt: true,
      printedAt: true,
    },
  });
}

export async function markPrintJobPrinting(id: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Printing",
      attempts: { increment: 1 },
    },
  });
}

export async function markPrintJobPrinted(id: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Printed",
      printedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function markPrintJobFailed(id: string, errorMessage: string) {
  return prisma.printJob.update({
    where: { id },
    data: {
      status: "Failed",
      errorMessage,
    },
  });
}

export type PrintStatusResponse = {
  status: PrintJobStatus;
  attempts: number;
  errorMessage: string | null;
  printedAt: string | null;
};

export function toPrintStatusResponse(
  job: {
    status: PrintJobStatus;
    attempts: number;
    errorMessage: string | null;
    printedAt: Date | null;
  } | null
): PrintStatusResponse | null {
  if (!job) return null;
  return {
    status: job.status,
    attempts: job.attempts,
    errorMessage: job.errorMessage,
    printedAt: job.printedAt?.toISOString() ?? null,
  };
}
