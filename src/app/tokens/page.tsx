"use client";

import { AppShell } from "@/components/AppShell";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { useAuth } from "@/components/AuthProvider";
import { formatDateTime } from "@/lib/jobs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type TokenRow = {
  id: string;
  tokenNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  complaint: string;
  estimatedMinutes: number;
  receivedAt: string;
  customer: { name?: string | null; mobile: string };
  assignedTechnician?: { name: string } | null;
};

function estimateLabel(mins: number) {
  if (mins === 60) return "1 hr";
  return `${mins} min`;
}

function TokensContent() {
  const { role, loaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"my" | "all">("my");
  const canCreate = role === "reception" || role === "admin";
  const statusFilter =
    searchParams.get("status") === "Pending" ||
    (canCreate && searchParams.get("status") !== "all")
      ? "Pending"
      : "all";

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (role === "technician") qs.set("scope", scope);
    if (statusFilter === "Pending") qs.set("status", "Pending");
    const res = await fetch(`/api/tokens?${qs.toString()}`);
    const data = await res.json();
    setTokens(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [role, scope, statusFilter]);

  useEffect(() => {
    if (!loaded) return;
    load();
  }, [loaded, load]);

  function setStatus(next: "Pending" | "all") {
    const qs = new URLSearchParams(searchParams.toString());
    if (next === "all") qs.set("status", "all");
    else qs.set("status", "Pending");
    router.replace(`/tokens?${qs.toString()}`);
  }

  return (
    <AppShell>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {role === "technician" ? "My Tokens" : "Tokens"}
          </p>
          {role === "technician" ? (
            <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScope("my")}
                className={`rounded px-2 py-1 ${scope === "my" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
              >
                My Tokens
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`rounded px-2 py-1 ${scope === "all" ? "bg-emerald-600 text-white" : "text-slate-600"}`}
              >
                All
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={role === "technician" ? "/jobs/pending?scope=my" : "/jobs/pending"}
            className="rounded-md border border-slate-300 bg-white py-2 text-center text-xs font-semibold text-slate-700"
          >
            {role === "technician" ? "My Jobs" : "Jobs"}
          </Link>
          <span className="rounded-md bg-emerald-600 py-2 text-center text-xs font-semibold text-white">
            {role === "technician" ? "My Tokens" : "Tokens"}
          </span>
        </div>

        {canCreate ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setStatus("Pending")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === "Pending"
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 bg-white text-slate-600"
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setStatus("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusFilter === "all"
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 bg-white text-slate-600"
              }`}
            >
              All open
            </button>
            <Link
              href="/tokens/new"
              className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
            >
              New Token
            </Link>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-500">
            {statusFilter === "Pending" ? "No pending tokens" : "No tokens"}
          </p>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link href={`/tokens/${token.id}`} className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-sm font-bold text-slate-900">
                      {token.tokenNumber}
                    </span>
                    <span className="min-w-0 truncate text-sm font-bold text-slate-900">
                      {token.customer.name ?? token.customer.mobile}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">
                    {[token.brand, token.applianceType]
                      .filter(Boolean)
                      .join(" · ")}
                    {` · ${token.assignedTechnician?.name ?? "Unassigned"}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created {formatDateTime(token.receivedAt)} · Est.{" "}
                    {estimateLabel(token.estimatedMinutes)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <CallCustomerButton mobile={token.customer.mobile} />
                  <JobStatusBadge status={token.status} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

export default function TokensPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="p-3 text-sm text-slate-500">Loading…</p>
        </AppShell>
      }
    >
      <TokensContent />
    </Suspense>
  );
}
