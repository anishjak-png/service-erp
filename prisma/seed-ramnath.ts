/**
 * Demo company: Ramnath Agencies
 * Jobs + tokens covering every workflow status. Idempotent — safe to re-run.
 *
 *   npx tsx prisma/seed-ramnath.ts
 */
import { PrismaClient, type JobStatus, type TokenStatus } from "@prisma/client";
import { hashPassword, normalizeMobile } from "../src/lib/password";
import { seedGenericAppliances } from "../src/lib/tenant-seed";

const prisma = new PrismaClient();

const SLUG = "ramnath-agencies";
const SHOP_NAME = "Ramnath Agencies";
const JOB_PREFIX = "RA";
const TOKEN_PREFIX = "TK";
const STAFF_PASSWORD = "ramnath123";

const TECHNICIANS = ["Tech A", "Tech B", "Tech C"] as const;
const OUTSOURCE_PARTNERS = ["Partner A", "Partner B", "Partner C"] as const;

const APPLIANCE_ROUTING: Record<string, string> = {
  Mixie: "Tech A",
  "Gas Stove": "Tech B",
  "Iron Box": "Tech B",
  Kettle: "Tech A",
  "Table Top Grinder": "Tech C",
  "Sewing Machine": "Tech C",
  "Induction Stove": "Tech A",
  "Pedestal Fan": "Tech C",
  "Table Fan": "Tech C",
  "Ceiling Fan": "Tech C",
  "Mosquito Bat": "Tech A",
};

const STAFF = [
  { mobile: "9440010001", name: "Ramnath Admin", role: "admin" as const },
  { mobile: "9440010002", name: "Priya Reception", role: "reception" as const },
  { mobile: "9440010003", name: "Kumar Verifier", role: "verifier" as const },
  {
    mobile: "9440010004",
    name: "Tech A Staff",
    role: "technician" as const,
    technicianName: "Tech A",
  },
  {
    mobile: "9440010005",
    name: "Tech B Staff",
    role: "technician" as const,
    technicianName: "Tech B",
  },
  {
    mobile: "9440010006",
    name: "Tech C Staff",
    role: "technician" as const,
    technicianName: "Tech C",
  },
];

type JobSeed = {
  jobNumber: string;
  customer: { name: string; mobile: string; address: string };
  applianceType: string;
  brand: string;
  model: string;
  complaint: string;
  status: JobStatus;
  assignedTech: (typeof TECHNICIANS)[number];
  isWarranty?: boolean;
  outsourcePartner?: (typeof OUTSOURCE_PARTNERS)[number];
  rackDetail?: string;
  deliveryContactStatus?: "not_contacted" | "contacted";
  serviceCharge?: number;
  serviceKind?: string;
  sparesAmount?: number;
  remarks?: string;
};

const JOBS: JobSeed[] = [
  {
    jobNumber: "RA-1",
    customer: {
      name: "Arun Kumar",
      mobile: "9440020001",
      address: "12 Gandhi Street, Coimbatore",
    },
    applianceType: "Mixie",
    brand: "Preethi",
    model: "Eco Plus",
    complaint: "Not powering on",
    status: "Pending",
    assignedTech: "Tech A",
  },
  {
    jobNumber: "RA-2",
    customer: {
      name: "Lakshmi Devi",
      mobile: "9440020002",
      address: "45 Avinashi Road",
    },
    applianceType: "Gas Stove",
    brand: "Butterfly",
    model: "3 Burner",
    complaint: "Not heating",
    status: "WaitingForCustomerApproval",
    assignedTech: "Tech B",
    serviceCharge: 850,
    serviceKind: "minor",
    remarks: "Quoted ₹850 — waiting for customer yes",
  },
  {
    jobNumber: "RA-3",
    customer: {
      name: "Suresh Babu",
      mobile: "9440020003",
      address: "8 Race Course",
    },
    applianceType: "Microwave",
    brand: "Samsung",
    model: "28L",
    complaint: "Strange noise",
    status: "Outsourced",
    assignedTech: "Tech A",
    outsourcePartner: "Partner A",
    remarks: "Magnetron — sent to Partner A",
  },
  {
    jobNumber: "RA-4",
    customer: {
      name: "Meena R",
      mobile: "9440020004",
      address: "22 RS Puram",
    },
    applianceType: "Kettle",
    brand: "Prestige",
    model: "1.5L",
    complaint: "Not heating",
    status: "WarrantyPending",
    assignedTech: "Tech A",
    isWarranty: true,
    remarks: "Warranty job at store",
  },
  {
    jobNumber: "RA-5",
    customer: {
      name: "Vijay Anand",
      mobile: "9440020005",
      address: "3 Peelamedu",
    },
    applianceType: "Iron Box",
    brand: "Philips",
    model: "GC1905",
    complaint: "Not heating",
    status: "WarrantyWithCompany",
    assignedTech: "Tech B",
    isWarranty: true,
    remarks: "Sent to company under warranty",
  },
  {
    jobNumber: "RA-6",
    customer: {
      name: "Kavitha S",
      mobile: "9440020006",
      address: "19 Saibaba Colony",
    },
    applianceType: "Table Top Grinder",
    brand: "Lakshmi",
    model: "2L",
    complaint: "Strange noise",
    status: "JobCompleted",
    assignedTech: "Tech C",
    serviceCharge: 450,
    serviceKind: "minor",
    sparesAmount: 120,
  },
  {
    jobNumber: "RA-7",
    customer: {
      name: "Ramesh N",
      mobile: "9440020007",
      address: "7 Singanallur",
    },
    applianceType: "Pedestal Fan",
    brand: "Crompton",
    model: "HS 400",
    complaint: "Not powering on",
    status: "Ready",
    assignedTech: "Tech C",
    serviceCharge: 300,
    serviceKind: "minor",
    rackDetail: "Rack A-12",
    deliveryContactStatus: "not_contacted",
  },
  {
    jobNumber: "RA-8",
    customer: {
      name: "Deepa M",
      mobile: "9440020008",
      address: "55 Trichy Road",
    },
    applianceType: "Induction Stove",
    brand: "Prestige",
    model: "PIC 20",
    complaint: "Not heating",
    status: "Ready",
    assignedTech: "Tech A",
    serviceCharge: 600,
    serviceKind: "major",
    rackDetail: "Rack B-03",
    deliveryContactStatus: "contacted",
  },
  {
    jobNumber: "RA-9",
    customer: {
      name: "Ganesh K",
      mobile: "9440020009",
      address: "14 Ukkadam",
    },
    applianceType: "Ceiling Fan",
    brand: "Usha",
    model: "Striker",
    complaint: "Strange noise",
    status: "Return",
    assignedTech: "Tech C",
    rackDetail: "Return shelf",
    deliveryContactStatus: "not_contacted",
    remarks: "Customer declined repair — return as-is",
  },
  {
    jobNumber: "RA-10",
    customer: {
      name: "Anitha P",
      mobile: "9440020010",
      address: "31 Gandhipuram",
    },
    applianceType: "Sewing Machine",
    brand: "Singer",
    model: "Tradition",
    complaint: "General service",
    status: "Return",
    assignedTech: "Tech C",
    rackDetail: "Return shelf",
    deliveryContactStatus: "contacted",
    remarks: "Called — customer coming to collect",
  },
  {
    jobNumber: "RA-11",
    customer: {
      name: "Murugan T",
      mobile: "9440020011",
      address: "9 Hope College",
    },
    applianceType: "Mosquito Bat",
    brand: "Others",
    model: "Rechargeable",
    complaint: "Not powering on",
    status: "Delivered",
    assignedTech: "Tech A",
    serviceCharge: 150,
    serviceKind: "minor",
    rackDetail: "Rack A-01",
    deliveryContactStatus: "contacted",
  },
];

type TokenSeed = {
  tokenNumber: string;
  customer: { name: string; mobile: string; address: string };
  applianceType: string;
  brand: string;
  complaint: string;
  status: TokenStatus;
  assignedTech: (typeof TECHNICIANS)[number];
  estimatedMinutes: number;
  serviceCharge?: number;
  serviceKind?: string;
};

const TOKENS: TokenSeed[] = [
  {
    tokenNumber: "TK-1",
    customer: {
      name: "Naveen Same-day",
      mobile: "9440020012",
      address: "Counter pickup",
    },
    applianceType: "Kettle",
    brand: "Bajaj",
    complaint: "Switch/cord issue",
    status: "Pending",
    assignedTech: "Tech A",
    estimatedMinutes: 30,
  },
  {
    tokenNumber: "TK-2",
    customer: {
      name: "Shalini Token",
      mobile: "9440020013",
      address: "Counter pickup",
    },
    applianceType: "Iron Box",
    brand: "Philips",
    complaint: "Not heating",
    status: "JobCompleted",
    assignedTech: "Tech B",
    estimatedMinutes: 45,
    serviceCharge: 200,
    serviceKind: "minor",
  },
  {
    tokenNumber: "TK-3",
    customer: {
      name: "Faisal Token Ready",
      mobile: "9440020014",
      address: "Counter pickup",
    },
    applianceType: "Mixie",
    brand: "Butterfly",
    complaint: "General service",
    status: "Ready",
    assignedTech: "Tech A",
    estimatedMinutes: 40,
    serviceCharge: 250,
    serviceKind: "minor",
  },
  {
    tokenNumber: "TK-4",
    customer: {
      name: "Helen Token Done",
      mobile: "9440020015",
      address: "Counter pickup",
    },
    applianceType: "Table Fan",
    brand: "Crompton",
    complaint: "Not powering on",
    status: "Delivered",
    assignedTech: "Tech C",
    estimatedMinutes: 20,
    serviceCharge: 180,
    serviceKind: "minor",
  },
];

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function upsertCustomer(
  tenantId: string,
  name: string,
  mobile: string,
  address: string
) {
  const normalized = normalizeMobile(mobile);
  return prisma.customer.upsert({
    where: {
      tenantId_mobile: { tenantId, mobile: normalized },
    },
    update: { name, address },
    create: { tenantId, name, mobile: normalized, address },
  });
}

async function main() {
  const passwordHash = await hashPassword(STAFF_PASSWORD);

  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: {
      name: SHOP_NAME,
      jobPrefix: JOB_PREFIX,
      tokenPrefix: TOKEN_PREFIX,
      status: "active",
      phone: "0422-1234567",
    },
    create: {
      slug: SLUG,
      name: SHOP_NAME,
      jobPrefix: JOB_PREFIX,
      tokenPrefix: TOKEN_PREFIX,
      status: "active",
      phone: "0422-1234567",
    },
  });

  await prisma.jobSequence.upsert({
    where: { tenantId: tenant.id },
    update: { lastNum: JOBS.length },
    create: { tenantId: tenant.id, lastNum: JOBS.length },
  });

  await prisma.tokenSequence.upsert({
    where: { tenantId: tenant.id },
    update: { lastNum: TOKENS.length },
    create: { tenantId: tenant.id, lastNum: TOKENS.length },
  });

  await prisma.notificationSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  await seedGenericAppliances(prisma, tenant.id);

  for (const name of TECHNICIANS) {
    await prisma.technician.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { active: true },
      create: { tenantId: tenant.id, name, active: true },
    });
  }

  for (const name of OUTSOURCE_PARTNERS) {
    await prisma.outsourcePartner.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { active: true },
      create: { tenantId: tenant.id, name, active: true },
    });
  }

  for (const [applianceType, techName] of Object.entries(APPLIANCE_ROUTING)) {
    const technician = await prisma.technician.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: techName } },
    });
    if (!technician) continue;
    await prisma.applianceTechnician.upsert({
      where: {
        tenantId_applianceType: { tenantId: tenant.id, applianceType },
      },
      update: { technicianId: technician.id },
      create: {
        tenantId: tenant.id,
        applianceType,
        technicianId: technician.id,
      },
    });
  }

  const techs = Object.fromEntries(
    await Promise.all(
      TECHNICIANS.map(async (name) => {
        const t = await prisma.technician.findUniqueOrThrow({
          where: { tenantId_name: { tenantId: tenant.id, name } },
        });
        return [name, t] as const;
      })
    )
  );

  const partners = Object.fromEntries(
    await Promise.all(
      OUTSOURCE_PARTNERS.map(async (name) => {
        const p = await prisma.outsourcePartner.findUniqueOrThrow({
          where: { tenantId_name: { tenantId: tenant.id, name } },
        });
        return [name, p] as const;
      })
    )
  );

  for (const s of STAFF) {
    const mobile = normalizeMobile(s.mobile);
    const technicianId = s.technicianName ? techs[s.technicianName].id : null;
    const existing = await prisma.staffUser.findUnique({ where: { mobile } });
    if (existing && existing.tenantId !== tenant.id) {
      console.warn(
        `Skip staff ${s.name} (${mobile}) — mobile already used by another shop`
      );
      continue;
    }
    await prisma.staffUser.upsert({
      where: { mobile },
      update: {
        tenantId: tenant.id,
        name: s.name,
        role: s.role,
        active: true,
        passwordHash,
        technicianId,
      },
      create: {
        tenantId: tenant.id,
        mobile,
        name: s.name,
        role: s.role,
        active: true,
        passwordHash,
        technicianId,
      },
    });
  }

  await prisma.tokenCard.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.jobCard.deleteMany({ where: { tenantId: tenant.id } });

  for (const job of JOBS) {
    const customer = await upsertCustomer(
      tenant.id,
      job.customer.name,
      job.customer.mobile,
      job.customer.address
    );
    const tech = techs[job.assignedTech];
    const completed =
      job.status === "JobCompleted" ||
      job.status === "Ready" ||
      job.status === "Delivered";
    const ready = job.status === "Ready" || job.status === "Delivered";
    const delivered = job.status === "Delivered";
    const outsourced = job.status === "Outsourced";
    const warrantyCompany = job.status === "WarrantyWithCompany";

    const created = await prisma.jobCard.create({
      data: {
        tenantId: tenant.id,
        jobNumber: job.jobNumber,
        customerId: customer.id,
        applianceType: job.applianceType,
        brand: job.brand,
        model: job.model,
        complaint: job.complaint,
        physicalCondition: "Good",
        accessories: "Power cord",
        status: job.status,
        remarks: job.remarks ?? null,
        assignedTechnicianId: tech.id,
        completedByTechnicianId: completed ? tech.id : null,
        serviceCharge: job.serviceCharge ?? null,
        serviceAmount: job.serviceCharge ?? null,
        serviceKind: job.serviceKind ?? null,
        sparesAmount: job.sparesAmount ?? null,
        rackDetail: job.rackDetail ?? null,
        deliveryContactStatus: job.deliveryContactStatus ?? "not_contacted",
        isWarranty: Boolean(job.isWarranty),
        outsourcedToId: job.outsourcePartner
          ? partners[job.outsourcePartner].id
          : null,
        outsourcedAt: outsourced ? daysAgo(2) : null,
        warrantyTakenAt: warrantyCompany ? daysAgo(3) : null,
        receivedAt: daysAgo(5),
        completedAt: completed ? daysAgo(1) : null,
        readyAt: ready ? daysAgo(1) : job.status === "Return" ? daysAgo(1) : null,
        deliveredAt: delivered ? new Date() : null,
        createdBy: "Ramnath Admin",
      },
    });

    const history: JobStatus[] = ["Pending"];
    if (job.status !== "Pending") history.push(job.status);
    await prisma.statusHistory.createMany({
      data: history.map((status, i) => ({
        jobCardId: created.id,
        status,
        note: i === 0 ? "Job created (seed)" : `Moved to ${status} (seed)`,
        changedBy: "Ramnath Admin",
        changedAt: daysAgo(5 - i),
      })),
    });
  }

  for (const token of TOKENS) {
    const customer = await upsertCustomer(
      tenant.id,
      token.customer.name,
      token.customer.mobile,
      token.customer.address
    );
    const tech = techs[token.assignedTech];
    const completed =
      token.status === "JobCompleted" ||
      token.status === "Ready" ||
      token.status === "Delivered";
    const ready = token.status === "Ready" || token.status === "Delivered";
    const delivered = token.status === "Delivered";

    await prisma.tokenCard.create({
      data: {
        tenantId: tenant.id,
        tokenNumber: token.tokenNumber,
        customerId: customer.id,
        applianceType: token.applianceType,
        brand: token.brand,
        complaint: token.complaint,
        physicalCondition: "Good",
        status: token.status,
        estimatedMinutes: token.estimatedMinutes,
        assignedTechnicianId: tech.id,
        completedByTechnicianId: completed ? tech.id : null,
        serviceCharge: token.serviceCharge ?? null,
        serviceAmount: token.serviceCharge ?? null,
        serviceKind: token.serviceKind ?? null,
        receivedAt: daysAgo(1),
        completedAt: completed ? new Date() : null,
        readyAt: ready ? new Date() : null,
        deliveredAt: delivered ? new Date() : null,
        createdBy: "Priya Reception",
      },
    });
  }

  console.log(`Seeded ${SHOP_NAME} (${SLUG})`);
  console.log("Staff password for all accounts:", STAFF_PASSWORD);
  console.log("Login at / with:");
  for (const s of STAFF) {
    console.log(`  ${s.role.padEnd(12)} ${s.mobile}  ${s.name}`);
  }
  console.log(`Jobs: ${JOBS.map((j) => `${j.jobNumber}=${j.status}`).join(", ")}`);
  console.log(
    `Tokens: ${TOKENS.map((t) => `${t.tokenNumber}=${t.status}`).join(", ")}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
