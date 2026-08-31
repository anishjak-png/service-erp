"use client";

import { APP_NAME } from "@/lib/constants";
import { formatMobileDisplay } from "@/lib/jobs";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TrackResult = {
  jobNumber: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  statusLabel: string;
};

function TrackForm() {
  const searchParams = useSearchParams();
  const tenantFromUrl = searchParams.get("tenant")?.trim() ?? "";
  const [tenantSlug, setTenantSlug] = useState(tenantFromUrl);
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrackResult[] | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);

    const digits = mobile.replace(/\D/g, "").slice(-10);
    const qs = new URLSearchParams({ mobile: digits });
    if (tenantSlug.trim()) qs.set("tenant", tenantSlug.trim());

    const res = await fetch(`/api/track?${qs.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not find jobs");
      setLoading(false);
      return;
    }

    setResults(data);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-emerald-800">{APP_NAME}</CardTitle>
          <p className="text-sm text-slate-500">Track your service status</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="tenant" className="text-sm font-medium text-slate-700">
                Shop name
              </label>
              <input
                id="tenant"
                type="text"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="e.g. UMA TRADERS"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="mobile" className="text-sm font-medium text-slate-700">
                Mobile Number
              </label>
              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Enter registered mobile number"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Searching..." : "Track Status"}
            </button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {results && results.length === 0 && (
            <p className="text-sm text-slate-500">No jobs found for this mobile.</p>
          )}

          {results && results.length > 0 && (
            <ul className="space-y-2">
              {results.map((job) => (
                <li
                  key={job.jobNumber}
                  className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="font-medium text-slate-800">{job.jobNumber}</div>
                  <div className="text-slate-600">
                    {job.applianceType} · {job.brand}
                    {job.model ? ` · ${job.model}` : ""}
                  </div>
                  <div className="mt-1 text-emerald-700">{job.statusLabel}</div>
                </li>
              ))}
            </ul>
          )}

          {results && mobile && (
            <p className="text-center text-xs text-slate-400">
              Showing jobs for {formatMobileDisplay(mobile)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 p-4">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      }
    >
      <TrackForm />
    </Suspense>
  );
}
