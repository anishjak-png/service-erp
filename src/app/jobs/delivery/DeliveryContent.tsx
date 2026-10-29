"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { JobListCard } from "@/components/JobListCard";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import type { DeliveryContactStatus } from "@prisma/client";
import { formatDoneDatestamp } from "@/lib/jobs";
import { fastGet, peekFastCache, invalidateJobCaches, peekStaleCache } from "@/lib/fast-fetch";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type DeliveryJob = {
  id: string;
  kind?: "job" | "token";
  jobNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  readyAt?: string | null;
  serviceAmount?: number | null;
  serviceCharge?: number | null;
  sparesAmount?: number | null;
  deliveryContactStatus?: DeliveryContactStatus;
  expectedDeliveryAt?: string | null;
  customer: { mobile: string; name?: string | null };
};

type DeliveryToken = {
  id: string;
  tokenNumber: string;
  status: string;
  applianceType: string;
  brand?: string | null;
  readyAt?: string | null;
  serviceAmount?: number | null;
  serviceCharge?: number | null;
  sparesAmount?: number | null;
  customer: { mobile: string; name?: string | null };
};

function tokenToDeliveryJob(token: DeliveryToken): DeliveryJob {
  return {
    id: token.id,
    kind: "token",
    jobNumber: token.tokenNumber,
    status: token.status,
    applianceType: token.applianceType,
    brand: token.brand,
    readyAt: token.readyAt,
    serviceAmount: token.serviceAmount,
    serviceCharge: token.serviceCharge,
    sparesAmount: token.sparesAmount,
    customer: token.customer,
  };
}

function matchesQuery(row: DeliveryJob, q: string) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return (
    row.jobNumber.toLowerCase().includes(needle) ||
    row.customer.mobile.includes(needle.replace(/\s/g, "")) ||
    (row.customer.name ?? "").toLowerCase().includes(needle)
  );
}

const DELIVERY_STATUSES = new Set(["Ready", "Return"]);

export default function DeliveryContent() {
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadJobs = useCallback(async (q: string) => {
    setSuccessMsg("");
    const params = new URLSearchParams({ delivery: "true" });
    if (q.trim()) params.set("q", q.trim());
    const url = `/api/jobs?${params}`;
    const tokensUrl = "/api/tokens?status=Ready";
    const warm =
      peekFastCache<DeliveryJob[]>(url, 60_000) ??
      peekStaleCache<DeliveryJob[]>(url);
    if (Array.isArray(warm)) {
      setResults(warm.filter((j) => DELIVERY_STATUSES.has(j.status)));
      setLoading(false);
    } else {
      setLoading(true);
    }

    const [data, tokens] = await Promise.all([
      fastGet<DeliveryJob[] | { error?: string }>(url, { ttlMs: 60_000 }),
      fastGet<DeliveryToken[] | { error?: string }>(tokensUrl, { ttlMs: 15_000 }),
    ]);
    const jobs = Array.isArray(data)
      ? data.filter((j) => DELIVERY_STATUSES.has(j.status)).map((j) => ({
          ...j,
          kind: "job" as const,
        }))
      : [];
    const readyTokens = Array.isArray(tokens)
      ? tokens.filter((t) => t.status === "Ready").map(tokenToDeliveryJob)
      : [];
    const needle = q.trim();
    setResults(
      [...jobs, ...readyTokens].filter((row) => matchesQuery(row, needle))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadJobs(initialQ);
  }, [initialQ, loadJobs]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadJobs(value), 80);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    loadJobs(query);
  }

  function handleCallLogged(
    jobId: string,
    result: {
      deliveryContactStatus: DeliveryContactStatus;
      expectedDeliveryAt: string | null;
    }
  ) {
    setResults((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              deliveryContactStatus: result.deliveryContactStatus,
              expectedDeliveryAt: result.expectedDeliveryAt,
            }
          : j
      )
    );
  }

  async function markDelivered(job: DeliveryJob) {
    if (!confirm(`Mark ${job.jobNumber} as delivered?`)) return;

    setDeliveringId(job.id);
    const path =
      job.kind === "token" ? `/api/tokens/${job.id}` : `/api/jobs/${job.id}`;
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Delivered" }),
    });

    if (res.ok) {
      invalidateJobCaches();
      setResults((prev) => prev.filter((j) => j.id !== job.id));
      setSuccessMsg(`${job.jobNumber} marked as delivered`);
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to mark delivered");
    }

    setDeliveringId(null);
  }

  const hasSearch = query.trim().length > 0;

  return (
    <AppShell>
      <form onSubmit={handleSearch} className="mb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search Job No or Mobile"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          autoFocus
        />
      </form>

      {successMsg && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-800">
          {successMsg}
        </div>
      )}

      {loading && results.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : results.length === 0 ? (
        <p className="text-center text-sm text-slate-500">
          {hasSearch
            ? "No ready jobs or tokens for this search"
            : "No jobs or tokens ready for delivery"}
        </p>
      ) : (
        <div className="space-y-2">
          {!hasSearch && (
            <p className="text-xs text-slate-500">
              {results.length} ready for pickup
            </p>
          )}
          {results.map((job) => {
            const appliance = [job.brand, job.applianceType]
              .filter(Boolean)
              .join(" ");
            const doneLabel = formatDoneDatestamp(job.readyAt);
            return (
              <JobListCard
                key={`${job.kind ?? "job"}-${job.id}`}
                id={job.id}
                kind={job.kind === "token" ? "token" : "job"}
                jobNumber={job.jobNumber}
                status={job.status}
                customerName={job.customer.name}
                mobile={job.customer.mobile}
                applianceLine={appliance}
                serviceAmount={job.serviceAmount}
                serviceCharge={job.serviceCharge}
                sparesAmount={job.sparesAmount}
                showBillSplit={role === "admin"}
                meta={doneLabel ?? undefined}
                deliveryContactStatus={
                  job.kind === "token"
                    ? undefined
                    : job.deliveryContactStatus ?? "not_contacted"
                }
                expectedDeliveryAt={job.expectedDeliveryAt}
                enableDeliveryCallLog={job.kind !== "token"}
                onDeliveryCallLogged={
                  job.kind === "token"
                    ? undefined
                    : (result) => handleCallLogged(job.id, result)
                }
                badge={
                  job.kind === "token" ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      Token
                    </span>
                  ) : (
                    <JobStatusBadge status={job.status} />
                  )
                }
                footer={
                  <button
                    onClick={() => markDelivered(job)}
                    disabled={deliveringId === job.id}
                    className="w-full rounded-md bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {deliveringId === job.id ? "Updating…" : "Delivered"}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
