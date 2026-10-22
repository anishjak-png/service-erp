"use client";

import { APP_NAME } from "@/lib/constants";
import { toTrackingPathSlug } from "@/lib/jobs";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TrackPage() {
  const router = useRouter();
  const [jobNumber, setJobNumber] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const slug = toTrackingPathSlug(jobNumber);
    if (!slug) {
      setError("Enter the job number from your receipt");
      return;
    }
    setError("");
    router.push(`/j/${encodeURIComponent(slug)}`);
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
              <label htmlFor="jobNumber" className="text-sm font-medium text-slate-700">
                Job number
              </label>
              <input
                id="jobNumber"
                type="text"
                required
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                placeholder="e.g. SE 12"
                autoComplete="off"
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Track Status
            </button>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
