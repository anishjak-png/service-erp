import { prisma } from "@/lib/db";
import {
  isValidTenantSlug,
  resolveTenantSlugFromRequest,
  slugFromHost,
  slugify,
} from "@/lib/tenant-host";

export type TenantRecord = {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  logoUrl: string | null;
  jobPrefix: string;
  status: string;
};

export { isValidTenantSlug, resolveTenantSlugFromRequest, slugFromHost, slugify };

const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  phone: true,
  logoUrl: true,
  jobPrefix: true,
  status: true,
} as const;

export async function getTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: slug.toLowerCase() },
    select: tenantSelect,
  });
  if (!tenant) return null;
  return tenant;
}

/** Resolve a shop by URL slug or display name (login / track). */
export async function getTenantBySlugOrName(
  input: string
): Promise<TenantRecord | null> {
  const raw = input.trim();
  if (!raw) return null;

  const asSlug = slugify(raw);
  if (asSlug) {
    const bySlug = await getTenantBySlug(asSlug);
    if (bySlug) return bySlug;
  }

  const matches = await prisma.tenant.findMany({
    where: { name: { equals: raw, mode: "insensitive" } },
    select: tenantSelect,
    take: 2,
  });
  return matches.length === 1 ? matches[0] : null;
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
