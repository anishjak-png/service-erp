"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ShopRow = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  jobPrefix: string;
  status: string;
  tariffNotes: string;
  adminName: string;
  adminMobile: string;
  adminPassword: string;
  licenseExpiresAt: string | null;
  createdAt: string;
  jobCount: number;
  staffCount: number;
};

type Totals = { all: number; active: number; suspended: number };

function addMonthsYmd(months: number): string {
  const parts = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-")
    .map(Number);
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatLicense(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function PlatformDashboard() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [totals, setTotals] = useState<Totals>({
    all: 0,
    active: 0,
    suspended: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminMobile, setAdminMobile] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [jobPrefix, setJobPrefix] = useState("");
  const [tariffNotes, setTariffNotes] = useState("");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, string>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [mobileDrafts, setMobileDrafts] = useState<Record<string, string>>({});
  const [licenseDrafts, setLicenseDrafts] = useState<Record<string, string>>({});
  const [editingLoginId, setEditingLoginId] = useState<string | null>(null);

  async function loadShops() {
    const res = await fetch("/api/platform/shops");
    if (res.status === 401) {
      router.replace("/platform/login");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to load shops");
      setLoading(false);
      return;
    }
    setShops(data.shops ?? []);
    setTotals(data.totals ?? { all: 0, active: 0, suspended: 0 });
    setLoading(false);
  }

  useEffect(() => {
    void loadShops();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch("/api/platform/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName,
          phone,
          adminName,
          adminMobile,
          adminPin,
          jobPrefix: jobPrefix.trim() || undefined,
          tariffNotes,
          licenseExpiresAt: licenseExpiresAt || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create shop");
        await loadShops();
        return;
      }
      setShopName("");
      setPhone("");
      setAdminName("");
      setAdminMobile("");
      setAdminPin("");
      setJobPrefix("");
      setTariffNotes("");
      setLicenseExpiresAt("");
      setSaved(`Created ${data.tenant?.name ?? "shop"}.`);
      await loadShops();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function patchShop(
    id: string,
    body: Record<string, unknown>,
    okMessage: string
  ): Promise<boolean> {
    setUpdatingId(id);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/platform/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update shop");
        return false;
      }
      setSaved(okMessage);
      await loadShops();
      return true;
    } catch {
      setError("Could not reach the server.");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function setStatus(id: string, status: "active" | "suspended") {
    await patchShop(id, { status }, status === "active" ? "Shop unlocked." : "Shop locked.");
  }

  async function saveShopDetails(id: string) {
    const shop = shops.find((s) => s.id === id);
    const notes = (tariffDrafts[id] ?? shop?.tariffNotes ?? "").trim();
    const license = licenseDrafts[id] ?? toDateInput(shop?.licenseExpiresAt);
    await patchShop(
      id,
      {
        tariffNotes: notes,
        licenseExpiresAt: license || null,
      },
      "Shop details saved."
    );
  }

  async function saveLogin(id: string) {
    const shop = shops.find((s) => s.id === id);
    const mobile = (mobileDrafts[id] ?? shop?.adminMobile ?? "").replace(/\D/g, "");
    const password = (passwordDrafts[id] ?? shop?.adminPassword ?? "").trim();
    if (mobile.length !== 10) {
      setError("Valid 10-digit admin mobile required");
      return;
    }
    if (password.length < 4) {
      setError("Admin password must be at least 4 characters");
      return;
    }
    const ok = await patchShop(
      id,
      { adminMobile: mobile, adminPassword: password },
      "Admin login saved."
    );
    if (ok) setEditingLoginId(null);
  }

  async function logout() {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    router.push("/platform/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-emerald-700 bg-emerald-900 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold uppercase tracking-wide text-white">
              Service ERP — Platform
            </h1>
            <p className="text-xs text-emerald-200">
              Create companies; each admin logs in with mobile and password
            </p>
          </div>
          <button
            onClick={logout}
            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-800"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Shops" value={totals.all} />
          <Stat label="LIVE" value={totals.active} />
          <Stat label="LOCKED" value={totals.suspended} />
        </div>

        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Create shop</h2>
          <p className="text-xs text-slate-500">
            Admin mobile must be unique across all companies. That admin then
            creates staff with their own mobile and password.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shop name">
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. UMA TRADERS"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Shop phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Admin name">
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Admin mobile (username)">
              <input
                value={adminMobile}
                onChange={(e) =>
                  setAdminMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="10-digit mobile"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Admin password / PIN">
              <input
                type="text"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                minLength={4}
                className={inputClass}
                required
              />
            </Field>
            <Field label="Job prefix (optional)">
              <input
                value={jobPrefix}
                onChange={(e) =>
                  setJobPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                }
                placeholder="Auto from shop name"
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="License expiry">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={licenseExpiresAt}
                    onChange={(e) => setLicenseExpiresAt(e.target.value)}
                    className={`${inputClass} sm:max-w-[12rem]`}
                  />
                  <button
                    type="button"
                    onClick={() => setLicenseExpiresAt(addMonthsYmd(6))}
                    className="rounded-md border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    6 months
                  </button>
                  <button
                    type="button"
                    onClick={() => setLicenseExpiresAt(addMonthsYmd(12))}
                    className="rounded-md border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    1 year
                  </button>
                </div>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Tariff notes (optional)">
                <textarea
                  value={tariffNotes}
                  onChange={(e) => setTariffNotes(e.target.value)}
                  placeholder="e.g. Rs 1,500 / month · 50 jobs included"
                  rows={2}
                  className={`${inputClass} h-auto py-2`}
                />
              </Field>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-700">{saved}</p>}
          <button
            type="submit"
            disabled={creating}
            className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create shop"}
          </button>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Shops</h2>
          </div>
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Loading shops…</p>
          ) : shops.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No shops yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shops.map((shop) => {
                const expired = isExpired(shop.licenseExpiresAt);
                return (
                <li key={shop.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {shop.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {shop.jobPrefix} · {shop.staffCount} staff · {shop.jobCount} jobs
                        {shop.phone ? ` · ${shop.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          shop.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {shop.status === "active" ? "LIVE" : "LOCKED"}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2">
                    {editingLoginId === shop.id ? (
                      <>
                        <Field label="Admin username">
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={
                              mobileDrafts[shop.id] ?? shop.adminMobile ?? ""
                            }
                            onChange={(e) =>
                              setMobileDrafts((prev) => ({
                                ...prev,
                                [shop.id]: e.target.value.replace(/\D/g, "").slice(0, 10),
                              }))
                            }
                            className={`${inputClass} h-9 font-mono`}
                          />
                        </Field>
                        <Field label="Admin password">
                          <input
                            type="text"
                            value={
                              passwordDrafts[shop.id] ?? shop.adminPassword ?? ""
                            }
                            onChange={(e) =>
                              setPasswordDrafts((prev) => ({
                                ...prev,
                                [shop.id]: e.target.value,
                              }))
                            }
                            className={`${inputClass} h-9 font-mono`}
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <button
                            type="button"
                            disabled={updatingId === shop.id}
                            onClick={() => saveLogin(shop.id)}
                            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Save login
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingLoginId(null)}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>
                          <span className="font-medium text-slate-500">
                            Admin username
                          </span>
                          <br />
                          <span className="font-mono text-sm text-slate-900">
                            {shop.adminMobile || "—"}
                          </span>
                          {shop.adminName ? (
                            <span className="text-slate-500"> · {shop.adminName}</span>
                          ) : null}
                        </p>
                        <p>
                          <span className="font-medium text-slate-500">
                            Admin password
                          </span>
                          <br />
                          <span className="font-mono text-sm text-slate-900">
                            {shop.adminPassword || "—"}
                          </span>
                        </p>
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLoginId(shop.id);
                              setMobileDrafts((prev) => ({
                                ...prev,
                                [shop.id]: shop.adminMobile ?? "",
                              }));
                              setPasswordDrafts((prev) => ({
                                ...prev,
                                [shop.id]: shop.adminPassword ?? "",
                              }));
                            }}
                            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit login
                          </button>
                        </div>
                      </>
                    )}
                    <div className="sm:col-span-2">
                      <p className="font-medium text-slate-500">
                        License expiry{" "}
                        <span className="text-slate-900">
                          {formatLicense(shop.licenseExpiresAt)}
                          {expired ? " (past)" : ""}
                        </span>
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <input
                          type="date"
                          value={
                            licenseDrafts[shop.id] ?? toDateInput(shop.licenseExpiresAt)
                          }
                          onChange={(e) =>
                            setLicenseDrafts((prev) => ({
                              ...prev,
                              [shop.id]: e.target.value,
                            }))
                          }
                          className={`${inputClass} h-9 sm:max-w-[12rem]`}
                        />
                        <button
                          type="button"
                          disabled={updatingId === shop.id}
                          onClick={() => {
                            const next = addMonthsYmd(6);
                            setLicenseDrafts((prev) => ({ ...prev, [shop.id]: next }));
                            void patchShop(
                              shop.id,
                              { licenseExpiresAt: next },
                              "License set to 6 months."
                            );
                          }}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          6 months
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === shop.id}
                          onClick={() => {
                            const next = addMonthsYmd(12);
                            setLicenseDrafts((prev) => ({ ...prev, [shop.id]: next }));
                            void patchShop(
                              shop.id,
                              { licenseExpiresAt: next },
                              "License set to 1 year."
                            );
                          }}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          1 year
                        </button>
                      </div>
                    </div>
                  </div>
                  <label className="block text-xs font-medium text-slate-600">
                    Tariff (internal)
                    <textarea
                      value={tariffDrafts[shop.id] ?? shop.tariffNotes ?? ""}
                      onChange={(e) =>
                        setTariffDrafts((prev) => ({
                          ...prev,
                          [shop.id]: e.target.value,
                        }))
                      }
                      placeholder="e.g. Rs 1,500 / month"
                      rows={2}
                      className={`${inputClass} mt-1 h-auto py-2`}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open login
                    </a>
                    <button
                      type="button"
                      disabled={updatingId === shop.id}
                      onClick={() => saveShopDetails(shop.id)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Save details
                    </button>
                    {shop.status === "active" ? (
                      <button
                        type="button"
                        disabled={updatingId === shop.id}
                        onClick={() => setStatus(shop.id, "suspended")}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Lock shop
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === shop.id}
                        onClick={() => setStatus(shop.id, "active")}
                        className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Unlock
                      </button>
                    )}
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
