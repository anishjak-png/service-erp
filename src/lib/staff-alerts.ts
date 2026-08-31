import { prisma } from "./db";

export async function createJobCompletedAlerts(params: {
  tenantId: string;
  jobId: string;
  jobNumber: string;
}) {
  await prisma.staffAlert.createMany({
    data: [
      {
        tenantId: params.tenantId,
        role: "verifier",
        type: "job_completed",
        title: `${params.jobNumber} is waiting for verification`,
        body: "Check the job, add the rack, then mark Ready.",
        jobCardId: params.jobId,
      },
      {
        tenantId: params.tenantId,
        role: "admin",
        type: "job_completed",
        title: `${params.jobNumber} is waiting for verification`,
        body: "Check the job, add the rack, then mark Ready.",
        jobCardId: params.jobId,
      },
    ],
  });
}

export async function countUnreadAlerts(
  tenantId: string,
  _role: "verifier" | "admin"
) {
  return prisma.jobCard.count({
    where: { tenantId, status: "JobCompleted" },
  });
}
