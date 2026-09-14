const memory = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 60_000;
const STALE_MS = 10 * 60_000;
const STORAGE_KEY = "erp-fast-get-v1";

let storageHydrated = false;

function hydrateFromStorage() {
  if (storageHydrated || typeof sessionStorage === "undefined") return;
  storageHydrated = true;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Array<[string, { at: number; data: unknown }]>;
    const now = Date.now();
    for (const [url, hit] of entries) {
      if (hit && now - hit.at < STALE_MS) memory.set(url, hit);
    }
  } catch {
    /* ignore */
  }
}

function persistToStorage() {
  if (typeof sessionStorage === "undefined") return;
  try {
    const now = Date.now();
    const entries: Array<[string, { at: number; data: unknown }]> = [];
    for (const [url, hit] of memory) {
      if (now - hit.at < STALE_MS) entries.push([url, hit]);
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota */
  }
}

hydrateFromStorage();

export function peekFastCache<T>(url: string, ttlMs = DEFAULT_TTL_MS): T | undefined {
  hydrateFromStorage();
  const hit = memory.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  return undefined;
}

/** Cached payload even after TTL, until STALE_MS. Use to paint instantly. */
export function peekStaleCache<T>(url: string, maxAgeMs = STALE_MS): T | undefined {
  hydrateFromStorage();
  const hit = memory.get(url);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.data as T;
  return undefined;
}

export function invalidateFastCache(prefix?: string) {
  if (!prefix) {
    memory.clear();
  } else {
    for (const key of memory.keys()) {
      if (key.startsWith(prefix)) memory.delete(key);
    }
  }
  persistToStorage();
}

export function invalidateJobCaches() {
  invalidateFastCache("/api/jobs");
  invalidateFastCache("/api/customers");
  invalidateFastCache("/api/dashboard");
  invalidateFastCache("/api/technician/stats");
}

export function prefetchStaffCaches() {
  void fastGet("/api/customers/directory", { ttlMs: 300_000 });
  void fastGet("/api/lookups?category=appliance", { ttlMs: 120_000 });
  void fastGet("/api/jobs?delivery=true", { ttlMs: 60_000 });
  void fastGet("/api/jobs?page=1&limit=25&active=true", { ttlMs: 60_000 });
  void fastGet("/api/jobs?page=1&limit=25&active=true&scope=my", {
    ttlMs: 60_000,
  });
}

export function prefetchNavHref(href: string) {
  const path = href.split("?")[0];
  if (path === "/jobs/pending" || href.includes("/jobs/pending")) {
    const scope = href.includes("scope=my") ? "my" : null;
    const params = new URLSearchParams({ page: "1", limit: "25", active: "true" });
    if (scope) params.set("scope", scope);
    void fastGet(`/api/jobs?${params}`, { ttlMs: 60_000 });
  } else if (path === "/jobs/delivery") {
    void fastGet("/api/jobs?delivery=true", { ttlMs: 60_000 });
  } else if (path === "/jobs/search") {
    void fastGet("/api/customers/directory", { ttlMs: 300_000 });
  } else if (path === "/jobs/ready") {
    void fastGet("/api/jobs?status=JobCompleted", { ttlMs: 60_000 });
  }
}

export async function fastGet<T>(
  url: string,
  options?: { ttlMs?: number; skipCache?: boolean }
): Promise<T> {
  hydrateFromStorage();
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  if (!options?.skipCache) {
    const hit = memory.get(url);
    if (hit && now - hit.at < ttl) {
      return hit.data as T;
    }
  }

  const pending = inflight.get(url);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = fetch(url)
    .then(async (res) => {
      const data = (await res.json().catch(() => null)) as T;
      if (res.ok) {
        memory.set(url, { at: Date.now(), data });
        persistToStorage();
      }
      return data;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request as Promise<T>;
}
