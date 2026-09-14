"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "./AuthProvider";
import { AppShell } from "./AppShell";

const BARE_EXACT = new Set([
  "/",
  "/signup",
  "/track",
  "/shop-login",
  "/platform/login",
  "/device-pending",
  "/whatsapp-pending",
]);

function shouldUseStaffShell(pathname: string) {
  if (BARE_EXACT.has(pathname)) return false;
  if (pathname.startsWith("/j/")) return false;
  if (pathname.startsWith("/platform")) return false;
  if (pathname.startsWith("/track")) return false;
  return true;
}

function StaffChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!shouldUseStaffShell(pathname)) {
    return <>{children}</>;
  }
  return <AppShell>{children}</AppShell>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StaffChrome>{children}</StaffChrome>
    </AuthProvider>
  );
}
