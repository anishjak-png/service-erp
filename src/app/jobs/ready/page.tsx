"use client";

import { AppShell } from "@/components/AppShell";
import { JobListCard } from "@/components/JobListCard";
import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ReadyJob = {
  id: string;
  jobNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  complaint: string;
  receivedAt: string;
  rackDetail?: string | null;
  serviceAmount?: number | null;
  serviceCharge?: number | null;
  sparesAmount?: number | null;
  customer: { name?: string | null; mobile: string };
  assignedTechnician?: { name: string } | null;
};

export default function ReadyVerificationPage() {
  const { role, loaded, refreshAuth } = useAuth();
  const [jobs, setJobs] = useState<ReadyJob[]>([]);
  const [loading, setLoading] = useState(true);

  const allowed = role === "verifier" || role === "admin";

  const load = useCallback(async () => {
    const res = await fetch("/api/jobs?status=JobCompleted");
    const data = await res.json();
    setJobs(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loaded || !allowed) return;
    load();
    fetch("/api/staff-alerts", { method: "POST" })
      .then(() => refreshAuth())
      .catch(() => {});
  }, [loaded, allowed, load, refreshAuth]);

  if (loaded && !allowed) {
    return (
      <AppShell>
        <p className="p-3 text-sm text-slate-600">
          Ready verification is only for verifier and admin.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ready
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-500">
            No jobs waiting for verification.
          </p>
        ) : (
          jobs.map((job) => (
            <JobListCard
              key={job.id}
              id={job.id}
              jobNumber={job.jobNumber}
              status={job.status}
              customerName={job.customer.name}
              mobile={job.customer.mobile}
              applianceLine={[job.brand, job.applianceType].filter(Boolean).join(" ")}
              complaint={job.complaint}
              assigneeName={job.assignedTechnician?.name}
              showAssignee
              meta={job.rackDetail ? `Rack ${job.rackDetail}` : "Rack not set"}
              serviceAmount={job.serviceAmount}
              serviceCharge={job.serviceCharge}
              sparesAmount={job.sparesAmount}
              showBillSplit
              showServiceAmount
            />
          ))
        )}
        <Link
          href="/jobs/search?status=JobCompleted"
          className="block text-center text-xs font-medium text-emerald-700"
        >
          Open in search
        </Link>
      </div>
    </AppShell>
  );
}
