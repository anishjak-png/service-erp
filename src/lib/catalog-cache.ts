const TTL_MS = 5 * 60 * 1000;

const memory = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function catalogGet<T>(url: string): Promise<T> {
  const now = Date.now();
  const hit = memory.get(url);
  if (hit && now - hit.at < TTL_MS) {
    return hit.data as T;
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

export function catalogPartners<T = Array<{ id: string; name: string }>>() {
  return catalogGet<T>("/api/outsource-partners");
}

export function catalogTechnicians<
  T = Array<{ id: string; name: string }>,
>() {
  return catalogGet<T>("/api/technicians");
}

export function catalogApplianceLookups<T = {
  brands?: string[];
  complaints?: string[];
  accessories?: string[];
}>(applianceType: string) {
  return catalogGet<T>(
    `/api/appliance-lookups?applianceType=${encodeURIComponent(applianceType)}`
  );
}

export function catalogApplianceTechnicians<
  T = Array<{ applianceType: string; technician: { name: string } }>,
>() {
  return catalogGet<T>("/api/appliance-technicians");
}
