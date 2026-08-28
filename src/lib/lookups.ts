import { prisma } from "./db";
import { getSession } from "./session";
import { requireTenantId } from "./tenant";

export type LookupCategory = "appliance" | "brand" | "complaint";

async function currentTenantId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const session = await getSession();
  return requireTenantId(session);
}

export async function getLookupOptionsBatch(
  categories: LookupCategory[],
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const options = await prisma.lookupOption.findMany({
    where: { tenantId: tid, category: { in: categories } },
    orderBy: [{ category: "asc" }, { value: "asc" }],
  });

  const result: Record<LookupCategory, typeof options> = {
    appliance: [],
    brand: [],
    complaint: [],
  };

  for (const option of options) {
    const category = option.category as LookupCategory;
    if (categories.includes(category)) {
      result[category].push(option);
    }
  }

  return result;
}

export async function getLookupOptions(
  category: LookupCategory,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  return prisma.lookupOption.findMany({
    where: { tenantId: tid, category },
    orderBy: { value: "asc" },
  });
}

export async function ensureLookupOption(
  category: LookupCategory,
  value: string,
  tenantId?: string
) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const tid = await currentTenantId(tenantId);

  return prisma.lookupOption.upsert({
    where: {
      tenantId_category_value: {
        tenantId: tid,
        category,
        value: trimmed,
      },
    },
    update: {},
    create: { tenantId: tid, category, value: trimmed },
  });
}

export async function getBrandsForAppliance(
  applianceType: string,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const rows = await prisma.applianceBrand.findMany({
    where: { tenantId: tid, applianceType },
    orderBy: { brand: "asc" },
  });
  return rows.map((row) => row.brand);
}

export async function getComplaintsForAppliance(
  applianceType: string,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const rows = await prisma.applianceComplaint.findMany({
    where: { tenantId: tid, applianceType },
    orderBy: { complaint: "asc" },
  });
  return rows.map((row) => row.complaint);
}

export async function getAccessoriesForAppliance(
  applianceType: string,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const rows = await prisma.applianceAccessory.findMany({
    where: { tenantId: tid, applianceType },
    orderBy: { accessory: "asc" },
  });
  return rows.map((row) => row.accessory);
}

export async function getApplianceLookups(
  applianceType: string,
  tenantId?: string
) {
  const [brands, complaints, accessories] = await Promise.all([
    getBrandsForAppliance(applianceType, tenantId),
    getComplaintsForAppliance(applianceType, tenantId),
    getAccessoriesForAppliance(applianceType, tenantId),
  ]);
  return { brands, complaints, accessories };
}

export async function addApplianceBrand(
  applianceType: string,
  brand: string,
  tenantId?: string
) {
  const trimmed = brand.trim();
  if (!trimmed) return { error: "Brand required" as const };
  const tid = await currentTenantId(tenantId);

  await ensureLookupOption("brand", trimmed, tid);

  const mapping = await prisma.applianceBrand.upsert({
    where: {
      tenantId_applianceType_brand: {
        tenantId: tid,
        applianceType,
        brand: trimmed,
      },
    },
    update: {},
    create: { tenantId: tid, applianceType, brand: trimmed },
  });

  return { mapping };
}

export async function addApplianceComplaint(
  applianceType: string,
  complaint: string,
  tenantId?: string
) {
  const trimmed = complaint.trim();
  if (!trimmed) return { error: "Complaint required" as const };
  const tid = await currentTenantId(tenantId);

  await ensureLookupOption("complaint", trimmed, tid);

  const mapping = await prisma.applianceComplaint.upsert({
    where: {
      tenantId_applianceType_complaint: {
        tenantId: tid,
        applianceType,
        complaint: trimmed,
      },
    },
    update: {},
    create: { tenantId: tid, applianceType, complaint: trimmed },
  });

  return { mapping };
}

export async function addApplianceAccessory(
  applianceType: string,
  accessory: string,
  tenantId?: string
) {
  const trimmed = accessory.trim();
  if (!trimmed) return { error: "Accessory required" as const };
  const tid = await currentTenantId(tenantId);

  const mapping = await prisma.applianceAccessory.upsert({
    where: {
      tenantId_applianceType_accessory: {
        tenantId: tid,
        applianceType,
        accessory: trimmed,
      },
    },
    update: {},
    create: { tenantId: tid, applianceType, accessory: trimmed },
  });

  return { mapping };
}

export async function removeApplianceAccessory(
  applianceType: string,
  accessory: string,
  tenantId?: string
) {
  const trimmed = accessory.trim();
  if (!trimmed) return { error: "Accessory required" as const };
  const tid = await currentTenantId(tenantId);

  await prisma.applianceAccessory.deleteMany({
    where: { tenantId: tid, applianceType, accessory: trimmed },
  });

  return { ok: true as const };
}

export async function removeApplianceBrand(
  applianceType: string,
  brand: string,
  tenantId?: string
) {
  const trimmed = brand.trim();
  if (!trimmed) return { error: "Brand required" as const };
  const tid = await currentTenantId(tenantId);

  await prisma.applianceBrand.deleteMany({
    where: { tenantId: tid, applianceType, brand: trimmed },
  });

  return { ok: true as const };
}

export async function removeApplianceComplaint(
  applianceType: string,
  complaint: string,
  tenantId?: string
) {
  const trimmed = complaint.trim();
  if (!trimmed) return { error: "Complaint required" as const };
  const tid = await currentTenantId(tenantId);

  await prisma.applianceComplaint.deleteMany({
    where: { tenantId: tid, applianceType, complaint: trimmed },
  });

  return { ok: true as const };
}

export async function ensureApplianceLookupOption(
  category: "brand" | "complaint",
  value: string,
  applianceType: string,
  tenantId?: string
) {
  const trimmed = value.trim();
  if (!trimmed || !applianceType.trim()) return null;
  const tid = await currentTenantId(tenantId);

  await ensureLookupOption(category, trimmed, tid);

  if (category === "brand") {
    await prisma.applianceBrand.upsert({
      where: {
        tenantId_applianceType_brand: {
          tenantId: tid,
          applianceType,
          brand: trimmed,
        },
      },
      update: {},
      create: { tenantId: tid, applianceType, brand: trimmed },
    });
  } else {
    await prisma.applianceComplaint.upsert({
      where: {
        tenantId_applianceType_complaint: {
          tenantId: tid,
          applianceType,
          complaint: trimmed,
        },
      },
      update: {},
      create: { tenantId: tid, applianceType, complaint: trimmed },
    });
  }

  return trimmed;
}

export async function isBrandAllowedForAppliance(
  applianceType: string,
  brand: string,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const mapping = await prisma.applianceBrand.findUnique({
    where: {
      tenantId_applianceType_brand: {
        tenantId: tid,
        applianceType,
        brand: brand.trim(),
      },
    },
  });
  return Boolean(mapping);
}

export async function isComplaintAllowedForAppliance(
  applianceType: string,
  complaint: string,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const mapping = await prisma.applianceComplaint.findUnique({
    where: {
      tenantId_applianceType_complaint: {
        tenantId: tid,
        applianceType,
        complaint: complaint.trim(),
      },
    },
  });
  return Boolean(mapping);
}

export async function isAccessoryAllowedForAppliance(
  applianceType: string,
  accessory: string,
  tenantId?: string
) {
  const trimmed = accessory.trim();
  if (trimmed.startsWith("Other:")) return true;
  const tid = await currentTenantId(tenantId);
  const mapping = await prisma.applianceAccessory.findUnique({
    where: {
      tenantId_applianceType_accessory: {
        tenantId: tid,
        applianceType,
        accessory: trimmed,
      },
    },
  });
  return Boolean(mapping);
}

export async function validateAccessoriesForAppliance(
  applianceType: string,
  accessories: string[],
  tenantId?: string
) {
  for (const accessory of accessories) {
    if (
      !(await isAccessoryAllowedForAppliance(applianceType, accessory, tenantId))
    ) {
      return false;
    }
  }
  return true;
}

export async function getDefaultTechnicianForAppliance(
  applianceType: string,
  tenantId?: string
) {
  const tid = await currentTenantId(tenantId);
  const mapping = await prisma.applianceTechnician.findUnique({
    where: {
      tenantId_applianceType: { tenantId: tid, applianceType },
    },
    include: { technician: true },
  });
  return mapping?.technician ?? null;
}

export async function updateApplianceOption(id: string, newValue: string) {
  const trimmed = newValue.trim();
  if (!trimmed) return { error: "Value required" as const };

  const existing = await prisma.lookupOption.findUnique({ where: { id } });
  if (!existing || existing.category !== "appliance") {
    return { error: "Appliance not found" as const };
  }

  if (existing.value === trimmed) {
    return { option: existing };
  }

  const tid = existing.tenantId;
  const duplicate = await prisma.lookupOption.findUnique({
    where: {
      tenantId_category_value: {
        tenantId: tid,
        category: "appliance",
        value: trimmed,
      },
    },
  });
  if (duplicate) {
    return { error: "Appliance name already exists" as const };
  }

  const oldValue = existing.value;

  const option = await prisma.$transaction(async (tx) => {
    await tx.jobCard.updateMany({
      where: { tenantId: tid, applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    const mapping = await tx.applianceTechnician.findUnique({
      where: {
        tenantId_applianceType: { tenantId: tid, applianceType: oldValue },
      },
    });
    if (mapping) {
      await tx.applianceTechnician.delete({
        where: {
          tenantId_applianceType: { tenantId: tid, applianceType: oldValue },
        },
      });
      await tx.applianceTechnician.create({
        data: {
          tenantId: tid,
          applianceType: trimmed,
          technicianId: mapping.technicianId,
        },
      });
    }

    await tx.applianceBrand.updateMany({
      where: { tenantId: tid, applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    await tx.applianceComplaint.updateMany({
      where: { tenantId: tid, applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    await tx.applianceAccessory.updateMany({
      where: { tenantId: tid, applianceType: oldValue },
      data: { applianceType: trimmed },
    });

    return tx.lookupOption.update({
      where: { id },
      data: { value: trimmed },
    });
  });

  return { option };
}

export async function deleteApplianceOption(id: string) {
  const existing = await prisma.lookupOption.findUnique({ where: { id } });
  if (!existing || existing.category !== "appliance") {
    return { error: "Appliance not found" as const };
  }

  const tid = existing.tenantId;
  const activeJobs = await prisma.jobCard.count({
    where: {
      tenantId: tid,
      applianceType: existing.value,
      status: {
        in: [
          "Pending",
          "WaitingForCustomerApproval",
          "Outsourced",
          "Ready",
          "Return",
        ],
      },
    },
  });

  if (activeJobs > 0) {
    return {
      error: `Cannot delete — ${activeJobs} active job(s) use this appliance`,
    } as const;
  }

  await prisma.$transaction([
    prisma.applianceTechnician.deleteMany({
      where: { tenantId: tid, applianceType: existing.value },
    }),
    prisma.applianceBrand.deleteMany({
      where: { tenantId: tid, applianceType: existing.value },
    }),
    prisma.applianceComplaint.deleteMany({
      where: { tenantId: tid, applianceType: existing.value },
    }),
    prisma.applianceAccessory.deleteMany({
      where: { tenantId: tid, applianceType: existing.value },
    }),
    prisma.lookupOption.delete({ where: { id } }),
  ]);

  return { ok: true as const };
}
