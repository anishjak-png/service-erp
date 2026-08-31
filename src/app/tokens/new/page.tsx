"use client";

import { AppShell } from "@/components/AppShell";
import { CreatableSelect } from "@/components/CreatableSelect";
import { useAuth } from "@/components/AuthProvider";
import { TOKEN_ESTIMATE_PRESETS } from "@/lib/constants";
import Link from "next/link";
import { FormEvent, useCallback, useRef, useState } from "react";

export default function NewTokenPage() {
  const { role, loaded } = useAuth();
  const [mobile, setMobile] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [applianceType, setApplianceType] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [complaint, setComplaint] = useState("");
  const [physicalCondition, setPhysicalCondition] = useState("");
  const [remarks, setRemarks] = useState("");
  const [estimate, setEstimate] = useState<string>("30");
  const [customMinutes, setCustomMinutes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ id: string; tokenNumber: string } | null>(null);

  const lookupMobileRef = useRef("");

  const lookupCustomer = useCallback(async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(-10);
    lookupMobileRef.current = digits;
    if (digits.length !== 10) return;

    const res = await fetch(`/api/customers/lookup?mobile=${digits}`);
    const data = await res.json();
    if (lookupMobileRef.current !== digits) return;
    if (data.found && data.name) {
      setCustomerName(data.name);
    }
  }, []);

  const allowed = role === "reception" || role === "admin";

  if (loaded && !allowed) {
    return (
      <AppShell>
        <p className="p-3 text-sm text-slate-600">Only reception or admin can create tokens.</p>
      </AppShell>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const estimatedMinutes =
      estimate === "custom" ? Number(customMinutes) : Number(estimate);
    setLoading(true);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile,
        customerName,
        applianceType,
        brand,
        model,
        complaint,
        physicalCondition,
        remarks,
        estimatedMinutes,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create token");
      return;
    }
    setCreated({ id: data.id, tokenNumber: data.tokenNumber });
  }

  if (created) {
    return (
      <AppShell>
        <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-900">
            Token {created.tokenNumber} created
          </p>
          <Link
            href={`/tokens/${created.id}`}
            className="block rounded-md bg-emerald-600 py-2.5 text-center text-sm font-medium text-white"
          >
            Open token
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setMobile("");
              setCustomerName("");
              setComplaint("");
            }}
            className="block w-full rounded-md border border-slate-300 bg-white py-2.5 text-sm"
          >
            New token
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          New Token
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <input
          type="tel"
          inputMode="numeric"
          placeholder="10-digit mobile number"
          value={mobile}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            setMobile(digits);
            setCustomerName("");
            lookupCustomer(digits);
          }}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          required
        />
        <input
          type="text"
          placeholder="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
        <CreatableSelect
          category="appliance"
          label="Product"
          value={applianceType}
          onChange={setApplianceType}
          onSelect={() => {
            setBrand("");
            setComplaint("");
          }}
          required
        />
        <CreatableSelect
          category="brand"
          label="Brand"
          value={brand}
          onChange={setBrand}
          applianceType={applianceType}
          disabled={!applianceType}
          required
        />
        <input
          type="text"
          placeholder="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
        <CreatableSelect
          category="complaint"
          label="Complaint"
          value={complaint}
          onChange={setComplaint}
          applianceType={applianceType}
          disabled={!applianceType}
          required
        />
        <input
          type="text"
          placeholder="Physical condition"
          value={physicalCondition}
          onChange={(e) => setPhysicalCondition(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        />
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Estimated time</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TOKEN_ESTIMATE_PRESETS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setEstimate(String(mins))}
                className={`rounded-md py-2 text-xs font-medium ${
                  estimate === String(mins)
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                {mins === 60 ? "1 hr" : `${mins} min`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEstimate("custom")}
              className={`rounded-md py-2 text-xs font-medium ${
                estimate === "custom"
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              Custom
            </button>
          </div>
          {estimate === "custom" ? (
            <input
              type="number"
              min={1}
              placeholder="Minutes"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          ) : null}
        </div>
        <textarea
          placeholder="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create token"}
        </button>
        <Link href="/jobs/new" className="block text-center text-xs text-slate-500">
          Need a job card instead?
        </Link>
      </form>
    </AppShell>
  );
}
