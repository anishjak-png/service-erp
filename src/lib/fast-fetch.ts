const memory = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 20_000;

export function peekFastCache<T>(url: string, ttlMs = DEFAULT_TTL_MS): T | undefined {
  const hit = memory.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  return undefined;
}

export function invalidateFastCache(prefix?: string) {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
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
  void fastGet("/api/jobs?delivery=true", { ttlMs: 8_000 });
}

export async function fastGet<T>(
  url: string,
  options?: { ttlMs?: number; skipCache?: boolean }
): Promise<T> {
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
      }
      return data;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request as Promise<T>;
}
