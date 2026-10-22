import { prisma } from "@/lib/db";

export function normalizeJobPrefix(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export async function isJobPrefixTaken(
  prefix: string,
  excludeTenantId?: string
): Promise<boolean> {
  const found = await prisma.tenant.findFirst({
    where: {
      jobPrefix: prefix,
      ...(excludeTenantId ? { NOT: { id: excludeTenantId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(found);
}

/** Returns a unique 1–6 character job prefix. */
export async function allocateUniqueJobPrefix(
  desired: string,
  excludeTenantId?: string
): Promise<string> {
  const base = normalizeJobPrefix(desired) || "SE";
  if (!(await isJobPrefixTaken(base, excludeTenantId))) return base;

  for (let n = 2; n < 1000; n++) {
    const suffix = String(n);
    const keep = Math.max(1, 6 - suffix.length);
    const candidate = `${base.slice(0, keep)}${suffix}`.slice(0, 6);
    if (!(await isJobPrefixTaken(candidate, excludeTenantId))) return candidate;
  }

  throw new Error("Could not allocate a unique job prefix");
}
