import { getSession, isDeviceApproved } from "./session";
import type { StaffRole } from "./session";
import {
  canCreateJob as canCreateJobRole,
  canDeliverJob as canDeliverJobRole,
} from "./roles";

export async function requireAdmin() {
  const session = await getSession();
  if (
    !session.isLoggedIn ||
    session.role !== "admin" ||
    !isDeviceApproved(session)
  ) {
    return null;
  }
  return session;
}

export async function requireStaff(allowed: StaffRole[]) {
  const session = await getSession();
  if (
    !session.isLoggedIn ||
    !allowed.includes(session.role) ||
    !isDeviceApproved(session)
  ) {
    return null;
  }
  return session;
}

export async function requireApprovedDevice() {
  const session = await getSession();
  if (!session.isLoggedIn || !isDeviceApproved(session)) {
    return null;
  }
  return session;
}

export function canCreateJob(role: StaffRole) {
  return canCreateJobRole(role);
}

export function canDeliverJob(role: StaffRole) {
  return canDeliverJobRole(role);
}

export function canEditDeliveredJob(role: StaffRole) {
  return role === "admin";
}

export function canReopenDeliveredJob(role: StaffRole) {
  return role === "admin";
}

export function canEditServiceAmount(role: StaffRole) {
  return role === "admin" || role === "verifier";
}

export function canEditCompletedBy(role: StaffRole) {
  return role === "admin";
}

/** WhatsApp inbox — admin only for v1; extend to reception later. */
export function canAccessWhatsAppInbox(role: StaffRole) {
  return role === "admin";
}

export async function requireWhatsAppInboxAccess() {
  const session = await getSession();
  if (
    !session.isLoggedIn ||
    !canAccessWhatsAppInbox(session.role) ||
    !isDeviceApproved(session)
  ) {
    return null;
  }
  return session;
}

/** Amount is locked once the technician has completed the job. */
export function isServiceAmountLocked(job: {
  readyAt: Date | null;
  completedAt?: Date | null;
}) {
  return job.readyAt != null || job.completedAt != null;
}
