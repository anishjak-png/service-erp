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
