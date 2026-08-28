"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function suggestSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function SignupPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminMobile, setAdminMobile] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : suggestSlug(shopName)),
    [slug, slugTouched, shopName]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName,
        slug: effectiveSlug,
        adminName,
        adminMobile,
        adminPin,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Signup failed");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(`/?tenant=${encodeURIComponent(data.tenant?.slug ?? effectiveSlug)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">
            Create your shop
          </CardTitle>
          <p className="text-sm text-slate-500">Service ERP — new tenant</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="shopName"
                className="text-sm font-medium text-slate-700"
              >
                Shop name
              </label>
              <input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Acme Appliance Service"
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="slug"
                className="text-sm font-medium text-slate-700"
              >
                Shop URL slug
              </label>
              <input
                id="slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                  );
                }}
                placeholder="your-shop"
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                required
              />
              <p className="text-xs text-slate-400">
                Login with ?tenant={effectiveSlug || "slug"} or{" "}
                {effectiveSlug || "slug"}.localhost
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="adminName"
                className="text-sm font-medium text-slate-700"
              >
                Admin name
              </label>
              <input
                id="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="adminMobile"
                className="text-sm font-medium text-slate-700"
              >
                Admin mobile
              </label>
              <input
                id="adminMobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={adminMobile}
                onChange={(e) =>
                  setAdminMobile(e.target.value.replace(/\D/g, ""))
                }
                placeholder="10-digit mobile"
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg tracking-wide placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="adminPin"
                className="text-sm font-medium text-slate-700"
              >
                Admin password / PIN
              </label>
              <input
                id="adminPin"
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                minLength={4}
                className="flex h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create shop"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm">
            <Link href="/" className="font-medium text-emerald-700 hover:underline">
              Already have a shop? Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
