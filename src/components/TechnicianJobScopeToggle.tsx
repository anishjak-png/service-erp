"use client";

import { useCallback, useState } from "react";

export type TechnicianJobScope = "my" | "all";

const STORAGE_KEY = "technicianJobScope";

function readStoredScope(): TechnicianJobScope {
  if (typeof window === "undefined") return "my";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "my" || saved === "all") return saved;
  } catch {
    /* ignore */
  }
  return "my";
}

export function useTechnicianJobScope() {
  const [scope, setScopeState] = useState<TechnicianJobScope>(readStoredScope);

  const setScope = useCallback((next: TechnicianJobScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { scope, setScope, ready: true as const };
}

export function TechnicianJobScopeToggle({
  scope,
  onChange,
}: {
  scope: TechnicianJobScope;
  onChange: (scope: TechnicianJobScope) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-0.5">
      <button
        type="button"
        onClick={() => onChange("my")}
        className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
          scope === "my"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        My Jobs
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
          scope === "all"
            ? "bg-emerald-600 text-white"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        All Jobs
      </button>
    </div>
  );
}
