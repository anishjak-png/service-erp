import { prisma } from "@/lib/db";

export type TenantRecord = {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  logoUrl: string | null;
  jobPrefix: string;
  status: string;
};

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "localhost",
  "vercel",
]);

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function isValidTenantSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])?$/.test(slug);
}

/** Extract tenant slug from host: acme.example.com → acme */
export function slugFromHost(hostHeader: string | null | undefined): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(":")[0].trim().toLowerCase();
  if (!host || host === "localhost") return null;

  const parts = host.split(".");
  if (host.endsWith(".vercel.app")) {
    if (parts.length < 4) return null;
    const slug = parts[0];
    if (RESERVED_SUBDOMAINS.has(slug)) return null;
    return slug;
  }

  if (parts.length < 3) return null;
  const slug = parts[0];
  if (RESERVED_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export function resolveTenantSlugFromRequest(input: {
  host?: string | null;
  searchParams?: URLSearchParams | { get(name: string): string | null };
  headerSlug?: string | null;
}): string | null {
  const fromHeader = input.headerSlug?.trim().toLowerCase();
  if (fromHeader) return fromHeader;

  const fromQuery = input.searchParams?.get("tenant")?.trim().toLowerCase();
  if (fromQuery) return fromQuery;

  const fromHost = slugFromHost(input.host ?? null);
  if (fromHost) return fromHost;

  return process.env.DEFAULT_TENANT_SLUG?.trim().toLowerCase() || null;
}

export async function getTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: slug.toLowerCase() },
    select: {
      id: true,
      slug: true,
      name: true,
      phone: true,
      logoUrl: true,
      jobPrefix: true,
      status: true,
    },
  });
  if (!tenant) return null;
  return tenant;
}

export function tenantWhere(session: { tenantId?: string | null }) {
  if (!session.tenantId) {
    throw new Error("Tenant context required");
  }
  return { tenantId: session.tenantId } as const;
}

/** Return tenantId from session or throw (API routes). */
export function requireTenantId(session: {
  isLoggedIn?: boolean;
  tenantId?: string | null;
}): string {
  if (!session.isLoggedIn || !session.tenantId) {
    throw new Error("Tenant context required");
  }
  return session.tenantId;
}

/** Soft check — null if missing. */
export function requireSessionTenantId(session: {
  isLoggedIn?: boolean;
  tenantId?: string;
}): string | null {
  if (!session.isLoggedIn || !session.tenantId) return null;
  return session.tenantId;
}

/** Feature flag for WhatsApp outbound/inbox (env-level kill switch). */
export function isWhatsAppEnabled(): boolean {
  const raw = process.env.WHATSAPP_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}
