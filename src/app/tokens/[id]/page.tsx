"use client";

import { AppShell } from "@/components/AppShell";
import { CallCustomerButton } from "@/components/CallCustomerButton";
import { JobStatusBadge } from "@/components/JobStatusBadge";
import { useAuth } from "@/components/AuthProvider";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/jobs";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type TokenDetail = {
  id: string;
  tokenNumber: string;
  status: string;
  applianceType: string;
  brand: string;
  model?: string | null;
  complaint: string;
  physicalCondition?: string | null;
  remarks?: string | null;
  estimatedMinutes: number;
  receivedAt?: string;
  serviceAmount?: number | null;
  serviceCharge?: number | null;
  serviceKind?: string | null;
  sparesAmount?: number | null;
  customer: { mobile: string; name?: string | null };
  assignedTechnician?: { name: string } | null;
};

export default function TokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [serviceCharge, setServiceCharge] = useState("");
  const [serviceKind, setServiceKind] = useState<"" | "minor" | "major">("");
  const [sparesAmount, setSparesAmount] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/tokens/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setToken(data);
    setServiceCharge(data.serviceCharge != null ? String(data.serviceCharge) : "");
    setServiceKind(
      data.serviceKind === "minor" || data.serviceKind === "major"
        ? data.serviceKind
        : ""
    );
    setSparesAmount(data.sparesAmount != null ? String(data.sparesAmount) : "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(status: string, extra: Record<string, unknown> = {}) {
    setSaving(true);
    const res = await fetch(`/api/tokens/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...extra }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Update failed");
      return;
    }
    await load();
  }

  if (!token) {
    return (
      <AppShell>
        <p className="p-3 text-sm text-slate-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-2">
        <Link href="/tokens" className="text-xs font-medium text-emerald-700">
          ← Tokens
        </Link>
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{token.tokenNumber}</h1>
            <JobStatusBadge status={token.status} />
            <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
              Token
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-800">
            {token.customer.name ?? token.customer.mobile}{" "}
            <CallCustomerButton mobile={token.customer.mobile} />
          </p>
          <p className="text-xs text-slate-500">
            {[token.brand, token.applianceType, token.model].filter(Boolean).join(" · ")}
            {` · ${token.assignedTechnician?.name ?? "Unassigned"}`}
          </p>
          <p className="text-xs text-slate-600">{token.complaint}</p>
          <p className="text-xs text-slate-500">
            {token.receivedAt ? `Created ${formatDateTime(token.receivedAt)}` : ""}
          </p>
          <p className="text-xs text-slate-500">
            Est. {token.estimatedMinutes === 60 ? "1 hr" : `${token.estimatedMinutes} min`}
          </p>
          {token.serviceAmount != null ? (
            <p className="mt-1 text-sm font-semibold text-emerald-700">
              {formatCurrency(token.serviceAmount)}
              {token.serviceKind === "minor"
                ? " · Minor"
                : token.serviceKind === "major"
                  ? " · Major"
                  : ""}
            </p>
          ) : null}
        </section>

        {token.status === "Pending" && (role === "technician" || role === "admin" || role === "reception") && (
          <section className="space-y-2 rounded-lg border border-teal-200 bg-teal-50 p-3">
            <p className="text-sm font-semibold text-teal-900">Job Completed</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className={`mb-1 block text-xs font-medium ${
                    showErrors && serviceCharge.trim() === ""
                      ? "text-red-700"
                      : "text-teal-900"
                  }`}
                >
                  Service charge *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Required"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(e.target.value)}
                  className={`h-10 w-full rounded-md border px-3 text-sm ${
                    showErrors && serviceCharge.trim() === ""
                      ? "border-red-500"
                      : "border-slate-300"
                  }`}
                />
                {showErrors && serviceCharge.trim() === "" && (
                  <p className="mt-0.5 text-xs text-red-600">Enter value</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-teal-900">
                  Spares
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={sparesAmount}
                  onChange={(e) => setSparesAmount(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
              </div>
            </div>
            <p
              className={`text-xs font-medium ${
                showErrors && serviceKind !== "minor" && serviceKind !== "major"
                  ? "text-red-700"
                  : "text-teal-900"
              }`}
            >
              Service type *
            </p>
            <div
              className={`flex gap-4 text-sm ${
                showErrors && serviceKind !== "minor" && serviceKind !== "major"
                  ? "text-red-700"
                  : "text-teal-900"
              }`}
            >
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={serviceKind === "minor"}
                  onChange={() =>
                    setServiceKind((prev) => (prev === "minor" ? "" : "minor"))
                  }
                />
                Minor service
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={serviceKind === "major"}
                  onChange={() =>
                    setServiceKind((prev) => (prev === "major" ? "" : "major"))
                  }
                />
                Major service
              </label>
            </div>
            {showErrors && serviceKind !== "minor" && serviceKind !== "major" && (
              <p className="-mt-1 text-xs text-red-600">Enter value</p>
            )}
            <button
              disabled={saving}
              onClick={() => {
                const chargeMissing = serviceCharge.trim() === "";
                const kindMissing =
                  serviceKind !== "minor" && serviceKind !== "major";
                if (chargeMissing || kindMissing) {
                  setShowErrors(true);
                  return;
                }
                updateStatus("JobCompleted", {
                  serviceCharge: Number(serviceCharge),
                  serviceKind,
                  sparesAmount: sparesAmount === "" ? 0 : Number(sparesAmount),
                });
              }}
              className="w-full rounded-md bg-teal-700 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Mark completed
            </button>
          </section>
        )}

        {token.status === "JobCompleted" && (role === "admin" || role === "reception" || role === "technician") && (
          <button
            disabled={saving}
            onClick={() => updateStatus("Ready")}
            className="w-full rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Mark Ready
          </button>
        )}

        {token.status === "Ready" && (role === "admin" || role === "reception" || role === "technician") && (
          <button
            disabled={saving}
            onClick={() => updateStatus("Delivered")}
            className="w-full rounded-md bg-slate-800 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Mark Delivered
          </button>
        )}
      </div>
    </AppShell>
  );
}
