import { JobStatus, PrismaClient } from "@prisma/client";

/**
 * Multi-tenancy: all new queries on tenant-scoped models MUST include tenantId.
 * See `tenantWhere` / `requireTenantId` in `src/lib/tenant.ts`.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Transaction-mode PgBouncer (Supabase :6543) cannot reuse prepared statements. */
function runtimeDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  const [base, query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const usesPooler =
    base.includes(":6543/") || params.get("pgbouncer") === "true";
  if (usesPooler) {
    params.set("pgbouncer", "true");
    params.set("connection_limit", "1");
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function prismaHasWarrantySupport(): boolean {
  return Boolean(
    JobStatus.WarrantyPending &&
      JobStatus.WarrantyWithCompany &&
      Object.values(JobStatus).includes(JobStatus.WarrantyPending)
  );
}

if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  if (!prismaHasWarrantySupport()) {
    void globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
    console.warn(
      "[prisma] Stale client detected — stop dev server, run `npx prisma generate`, delete `.next`, restart."
    );
  }
}

const datasourceUrl = runtimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  });

globalForPrisma.prisma = prisma;
