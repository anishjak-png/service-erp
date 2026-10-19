import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ACTIVE_JOB_STATUSES,
  TECH_MY_BOARD_STATUSES,
  WARRANTY_JOB_STATUSES,
  warrantyFieldsSupported,
} from "@/lib/prisma-statuses";

export type JobBoardCounts = {
  active: number;
  outsourced: number;
  warranty: number;
};

/** Shared pending-board chip counts. Used by GET /api/jobs?includeCounts=1. */
export async function getJobBoardCounts(opts: {
  tenantId: string;
  technicianId?: string | null;
  myScope: boolean;
}): Promise<JobBoardCounts> {
  const tenantFilter = { tenantId: opts.tenantId };
  const myBoard = Boolean(opts.myScope && opts.technicianId);
  const activeStatuses = myBoard ? TECH_MY_BOARD_STATUSES : ACTIVE_JOB_STATUSES;

  const activeWhere: Record<string, unknown> = {
    ...tenantFilter,
    status: { in: activeStatuses },
  };
  if (myBoard) {
    activeWhere.assignedTechnicianId = opts.technicianId;
  }

  const [active, outsourced, warranty] = await Promise.all([
    activeStatuses.length > 0
      ? prisma.jobCard.count({ where: activeWhere })
      : Promise.resolve(0),
    prisma.jobCard.count({
      where: { ...tenantFilter, status: "Outsourced" as JobStatus },
    }),
    warrantyFieldsSupported() && WARRANTY_JOB_STATUSES.length > 0
      ? prisma.jobCard.count({
          where: {
            ...tenantFilter,
            isWarranty: true,
            status: { in: WARRANTY_JOB_STATUSES },
          },
        })
      : Promise.resolve(0),
  ]);

  return { active, outsourced, warranty };
}
