import { PrismaClient } from "@prisma/client";
import { hashPassword, normalizeMobile } from "../src/lib/password";
import { seedGenericAppliances } from "../src/lib/tenant-seed";

const prisma = new PrismaClient();

const TECHNICIANS = ["Tech A", "Tech B", "Tech C"];
const OUTSOURCE_PARTNERS = ["Partner A", "Partner B", "Partner C"];

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

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {
      name: "Demo Shop",
      jobPrefix: "SE",
      tokenPrefix: "TK",
      status: "active",
      phone: "",
    },
    create: {
      slug: "demo",
      name: "Demo Shop",
      jobPrefix: "SE",
      tokenPrefix: "TK",
      status: "active",
      phone: "",
    },
  });

  await prisma.jobSequence.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, lastNum: 0 },
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

  const adminMobile = process.env.ADMIN_MOBILE?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (adminMobile && adminPassword) {
    const mobile = normalizeMobile(adminMobile);
    const passwordHash = await hashPassword(adminPassword);
    const existing = await prisma.staffUser.findUnique({ where: { mobile } });
    if (existing && existing.tenantId !== tenant.id) {
      console.warn(
        "ADMIN_MOBILE already used by another shop — skip demo admin seed"
      );
    } else {
      await prisma.staffUser.upsert({
        where: { mobile },
        update: {
          tenantId: tenant.id,
          name: "Admin",
          role: "admin",
          active: true,
          passwordHash,
        },
        create: {
          tenantId: tenant.id,
          mobile,
          name: "Admin",
          role: "admin",
          active: true,
          passwordHash,
        },
      });
      console.log("Demo admin seeded for mobile:", mobile, "tenant=demo");
    }
  } else {
    console.warn(
      "ADMIN_MOBILE and ADMIN_PASSWORD not set — skip demo admin staff seed"
    );
  }

  console.log("Seed completed — tenant slug=demo, technicians:", TECHNICIANS.join(", "));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
