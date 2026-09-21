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
  createdAt: string;
  jobCount: number;
  staffCount: number;
};

type Totals = { all: number; active: number; suspended: number };

export function PlatformDashboard() {
  const router = useRouter();
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ all: 0, active: 0, suspended: 0 });
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
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, string>>({});

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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create shop");
        return;
      }
      setShopName("");
      setPhone("");
      setAdminName("");
      setAdminMobile("");
      setAdminPin("");
      setJobPrefix("");
      setTariffNotes("");
      setSaved(`Created ${data.tenant?.name ?? "shop"}.`);
      await loadShops();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: "active" | "suspended") {
    setUpdatingId(id);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/platform/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update shop");
        return;
      }
      await loadShops();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveTariff(id: string) {
    const notes = (tariffDrafts[id] ?? shops.find((s) => s.id === id)?.tariffNotes ?? "").trim();
    setUpdatingId(id);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/platform/shops/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariffNotes: notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save tariff");
        return;
      }
      setSaved("Tariff saved.");
      await loadShops();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUpdatingId(null);
    }
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
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Shops" value={totals.all} />
          <Stat label="Active" value={totals.active} />
          <Stat label="Locked" value={totals.suspended} />
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
            <Field label="Admin mobile">
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
                type="password"
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
              {shops.map((shop) => (
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
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        shop.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {shop.status === "active" ? "Active" : "Locked"}
                    </span>
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
                      onClick={() => saveTariff(shop.id)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Save tariff
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
              ))}
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
