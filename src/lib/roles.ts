export const STAFF_ROLES = [
  "reception",
  "technician",
  "admin",
  "verifier",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    (STAFF_ROLES as readonly string[]).includes(value)
  );
}

export function canCreateJob(role: StaffRole) {
  return role === "reception" || role === "admin" || role === "technician";
}

export function canCreateToken(role: StaffRole) {
  return role === "reception" || role === "admin";
}

export function canDeliverJob(role: StaffRole) {
  return role === "reception" || role === "admin" || role === "technician";
}

export function canMarkJobCompleted(role: StaffRole) {
  return (
    role === "technician" ||
    role === "reception" ||
    role === "admin"
  );
}

export function canMarkJobReady(role: StaffRole) {
  return role === "verifier" || role === "admin";
}

export function canEditRack(role: StaffRole) {
  return (
    role === "verifier" ||
    role === "admin" ||
    role === "reception"
  );
}

export function canViewReadyQueue(role: StaffRole) {
  return role === "verifier" || role === "admin";
}

export function roleLabel(role: StaffRole | null | undefined): string {
  if (role === "technician") return "Technician";
  if (role === "reception") return "Reception";
  if (role === "admin") return "Admin";
  if (role === "verifier") return "Verifier";
  return "Staff";
}
