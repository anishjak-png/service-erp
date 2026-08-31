"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PRINTER_PURPOSE_LABELS,
  PRINTER_PURPOSES,
} from "@/lib/printer-purposes";
import { useCallback, useEffect, useState } from "react";

type ShopPrinter = {
  id: string;
  name: string;
  printerId: string;
  purposes: string[];
  active: boolean;
};

const PURPOSE_OPTIONS = PRINTER_PURPOSES.map((id) => ({
  id,
  label: PRINTER_PURPOSE_LABELS[id],
}));

export function PrintersTab() {
  const [printers, setPrinters] = useState<ShopPrinter[]>([]);
  const [name, setName] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [purposes, setPurposes] = useState<string[]>(["job_new"]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/printers");
    const data = await res.json();
    setPrinters(Array.isArray(data.printers) ? data.printers : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addPrinter() {
    setError("");
    const res = await fetch("/api/admin/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, printerId, purposes }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to save printer");
      return;
    }
    setName("");
    setPrinterId("");
    setPurposes(["job_new"]);
    await load();
  }

  async function setPrinterPurposes(id: string, next: string[]) {
    await fetch(`/api/admin/printers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purposes: next }),
    });
    await load();
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/admin/printers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    await load();
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Print connector</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            The <code>.env</code> file is on the shop Windows PC, not on this
            website. Clients never type it here.
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Download the connector and unzip it on the shop PC.</li>
            <li>
              Run <code>shop-pc\INSTALL.bat</code>. It copies the template to{" "}
              <code>.env</code> and can open Notepad.
            </li>
            <li>
              Typical path after install:{" "}
              <code>C:\Users\&lt;name&gt;\UmaService\uma_service\.env</code>
            </li>
            <li>
              In Notepad, set <code>PRINTER_ID</code> to the same ID you add
              below (e.g. <code>counter-1</code>), plus{" "}
              <code>PRINTER_IP</code> and <code>PRINTER_NAME</code>. Save the
              file.
            </li>
            <li>
              One connector per printer if the shop has two or three printers.
            </li>
          </ol>
          <a
            href="/api/admin/print-connector"
            className="inline-block rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          >
            Download print connector
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shop printers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <input
            placeholder="Printer name (e.g. Counter)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
          <input
            placeholder="Printer ID (must match connector PRINTER_ID)"
            value={printerId}
            onChange={(e) => setPrinterId(e.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {PURPOSE_OPTIONS.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={purposes.includes(p.id)}
                  onChange={(e) =>
                    setPurposes((prev) =>
                      e.target.checked
                        ? [...prev, p.id]
                        : prev.filter((x) => x !== p.id)
                    )
                  }
                />
                {p.label}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={addPrinter}
            className="h-10 w-full rounded-md bg-slate-800 text-sm font-medium text-white"
          >
            Add printer
          </button>
        </CardContent>
      </Card>

      {printers.map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-2 pt-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">{p.printerId}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleActive(p.id, !p.active)}
                className="text-xs font-medium text-emerald-700"
              >
                {p.active ? "Disable" : "Enable"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {PURPOSE_OPTIONS.map((opt) => (
                <label key={opt.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={p.purposes.includes(opt.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...p.purposes, opt.id]
                        : p.purposes.filter((x) => x !== opt.id);
                      setPrinterPurposes(p.id, next);
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
