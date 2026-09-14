export type DirectoryCustomer = {
  id: string;
  name: string | null;
  mobile: string;
};

export function matchDirectoryCustomers(
  list: DirectoryCustomer[],
  q: string,
  limit = 12
): DirectoryCustomer[] {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const digits = trimmed.replace(/\D/g, "");
  const mobileTyped = digits.length >= 2 && /^[\d\s+\-()]+$/.test(trimmed);

  if (mobileTyped) {
    return list.filter((c) => c.mobile.includes(digits)).slice(0, limit);
  }

  const needle = trimmed.toLowerCase();
  const starts: DirectoryCustomer[] = [];
  const contains: DirectoryCustomer[] = [];
  for (const c of list) {
    const name = (c.name ?? "").toLowerCase();
    if (!name) continue;
    if (name.startsWith(needle)) starts.push(c);
    else if (name.includes(needle)) contains.push(c);
    if (starts.length >= limit) break;
  }
  return starts.concat(contains).slice(0, limit);
}
