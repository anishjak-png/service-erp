export const APP_NAME = "Service ERP";
export const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Your Shop";
export const SHOP_PHONE = process.env.NEXT_PUBLIC_SHOP_PHONE ?? "";
/** Default job number prefix when tenant has none (multi-tenant overrides per shop). */
export const DEFAULT_JOB_PREFIX = process.env.JOB_NUMBER_PREFIX?.trim() || "SE";
/** Default token number prefix when tenant has none. */
export const DEFAULT_TOKEN_PREFIX = "TK";

/** Public base URL for tracking links, receipts, etc. */
function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    const host = production.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}

export const APP_URL = resolveAppUrl();

/** Resolve at call time so server notifications use current env (not a stale build). */
export function getAppUrl(): string {
  return resolveAppUrl();
}

export const MAX_PRODUCT_PHOTOS = 3;
export const MAX_WARRANTY_CARD_PHOTOS = 2;

export const JOB_STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Outsourced",
  "WarrantyPending",
  "WarrantyWithCompany",
  "JobCompleted",
  "Ready",
  "Return",
  "Delivered",
] as const;

export type JobStatusValue = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  WaitingForCustomerApproval: "Waiting for Customer Approval",
  Outsourced: "Outsourced",
  WarrantyPending: "Warranty (at store)",
  WarrantyWithCompany: "Warranty (with company)",
  JobCompleted: "Job Completed",
  Ready: "Ready",
  Return: "Return",
  Delivered: "Delivered",
};

export const WARRANTY_STATUSES = [
  "WarrantyPending",
  "WarrantyWithCompany",
] as const;

export const ACTIVE_STATUSES = [
  "Pending",
  "WaitingForCustomerApproval",
  "Outsourced",
  "WarrantyPending",
  "WarrantyWithCompany",
  "JobCompleted",
  "Ready",
  "Return",
] as const;

export type StaffRole = "reception" | "technician" | "admin" | "verifier";

export const TOKEN_ESTIMATE_PRESETS = [15, 30, 60] as const;

export const SERVICE_KINDS = ["minor", "major"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export function isServiceKind(value: unknown): value is ServiceKind {
  return value === "minor" || value === "major";
}

export function serviceKindLabel(kind: string | null | undefined): string {
  if (kind === "minor") return "Minor service";
  if (kind === "major") return "Major service";
  return "";
}

function isWarrantyStatus(status: string): boolean {
  return (
    status === "WarrantyPending" || status === "WarrantyWithCompany"
  );
}

function allowReadyStatus(role: StaffRole): boolean {
  return role === "admin" || role === "verifier";
}

function withoutReadyUnlessAllowed(
  statuses: JobStatusValue[],
  role: StaffRole
): JobStatusValue[] {
  if (allowReadyStatus(role)) return statuses;
  return statuses.filter((status) => status !== "Ready");
}

/** Flexible status selection — no strict sequential flow. */
export function getSelectableStatuses(
  current: JobStatusValue,
  role: StaffRole,
  opts?: { isWarranty?: boolean }
): JobStatusValue[] {
  if (current === "Delivered") {
    if (role !== "admin") return [];
    return withoutReadyUnlessAllowed([...ACTIVE_STATUSES], role);
  }

  if (role === "verifier") {
    if (current === "JobCompleted") return ["Ready"];
    return [];
  }

  if (isWarrantyStatus(current)) {
    if (role === "technician") {
      return ["JobCompleted", "Return"];
    }
    if (current === "WarrantyPending") {
      return ["WarrantyWithCompany", "JobCompleted", "Return"];
    }
    return ["WarrantyPending", "JobCompleted", "Return"];
  }

  if (current === "Outsourced") {
    const outsourcedOptions: JobStatusValue[] =
      role === "admin"
        ? ["JobCompleted", "Ready", "Return", "Pending", "WaitingForCustomerApproval"]
        : ["JobCompleted", "Return"];
    if (!opts?.isWarranty) {
      return withoutReadyUnlessAllowed(
        [...outsourcedOptions, "WarrantyPending"],
        role
      );
    }
    return withoutReadyUnlessAllowed(outsourcedOptions, role);
  }

  const options = JOB_STATUSES.filter(
    (s) =>
      s !== current &&
      s !== "Delivered" &&
      !isWarrantyStatus(s) &&
      (allowReadyStatus(role) || s !== "Ready")
  );

  if (!opts?.isWarranty) {
    return withoutReadyUnlessAllowed([...options, "WarrantyPending"], role);
  }

  return withoutReadyUnlessAllowed(options, role);
}

export function isDeliveredTerminal(status: string): boolean {
  return status === "Delivered";
}
