/**
 * Edge-safe tenant host/slug helpers (no Prisma / Node-only imports).
 * Safe for Next.js middleware on Vercel Edge.
 */

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
