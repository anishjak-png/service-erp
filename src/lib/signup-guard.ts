import { timingSafeEqual } from "crypto";

export function getSignupInviteCode(): string | null {
  const raw = process.env.SIGNUP_INVITE_CODE?.trim();
  return raw || null;
}

export function isSignupOpen(): boolean {
  return Boolean(getSignupInviteCode());
}

export function isValidSignupInvite(input: unknown): boolean {
  const expected = getSignupInviteCode();
  if (!expected) return false;
  if (typeof input !== "string") return false;
  const provided = input.trim();
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
