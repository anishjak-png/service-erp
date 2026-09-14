export default function DashboardLoading() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="h-20 animate-pulse rounded-md bg-slate-200" />
        <div className="h-20 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="h-24 animate-pulse rounded-md bg-slate-200" />
      <div className="h-24 animate-pulse rounded-md bg-slate-200" />
    </div>
  );
}
