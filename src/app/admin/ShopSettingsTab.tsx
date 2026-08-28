"use client";

import { FormEvent, useEffect, useState } from "react";

type ShopSettings = {
  id: string;
  slug: string;
  name: string;
  phone: string;
  logoUrl: string | null;
  jobPrefix: string;
  status: string;
};

export function ShopSettingsTab() {
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [jobPrefix, setJobPrefix] = useState("SE");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/shop");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Failed to load shop settings");
        setLoading(false);
        return;
      }
      setShop(data);
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setSlug(data.slug ?? "");
      setJobPrefix(data.jobPrefix ?? "SE");
      setLogoUrl(data.logoUrl ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");
    const res = await fetch("/api/admin/shop", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        slug,
        jobPrefix,
        logoUrl: logoUrl.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setShop(data);
    setSaved("Shop settings saved.");
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading shop settings…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Shop settings</h2>
        <p className="text-xs text-slate-500">
          Branding for receipts and job numbers. Product chrome stays Service ERP.
        </p>
      </div>

      <label className="block text-xs font-medium text-slate-600">
        Shop name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          required
        />
      </label>

      <label className="block text-xs font-medium text-slate-600">
        Phone
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
      </label>

      <label className="block text-xs font-medium text-slate-600">
        URL slug
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          required
        />
      </label>

      <label className="block text-xs font-medium text-slate-600">
        Job number prefix
        <input
          value={jobPrefix}
          onChange={(e) => setJobPrefix(e.target.value.toUpperCase())}
          maxLength={6}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          required
        />
      </label>

      <label className="block text-xs font-medium text-slate-600">
        Logo URL (optional)
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="mt-1 flex h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          placeholder="https://…"
        />
      </label>

      {shop && (
        <p className="text-xs text-slate-500">
          Status: {shop.status} · Sign-in tip: use slug <span className="font-mono">{shop.slug}</span>
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-700">{saved}</p>}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
