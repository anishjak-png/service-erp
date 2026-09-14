import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { ReceptionDashboard } from "@/components/dashboard/ReceptionDashboard";
import {
  getAdminDashboardData,
  getReceptionDashboardData,
} from "@/lib/dashboard-data";
import { getSession } from "@/lib/session";
import { requireTenantId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect("/");
  }

  if (session.role === "technician") {
    redirect("/jobs/pending?scope=my");
  }

  if (session.role === "verifier") {
    redirect("/jobs/ready");
  }

  let tenantId: string;
  try {
    tenantId = requireTenantId(session);
  } catch {
    redirect("/?reauth=1");
  }

  try {
    if (session.role === "admin") {
      const data = await getAdminDashboardData(tenantId);
      return (
        <AppShell>
          <AdminDashboard data={data} />
        </AppShell>
      );
    }

    const data = await getReceptionDashboardData(tenantId);
    return (
      <AppShell>
        <ReceptionDashboard data={data} />
      </AppShell>
    );
  } catch (err) {
    console.error("[dashboard]", err);
    return (
      <AppShell>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Home could not load
          </p>
          <p className="mt-1 text-sm text-amber-800">
            The dashboard could not read jobs just now. Open Pending or tap Home
            again.
          </p>
        </div>
      </AppShell>
    );
  }
}
