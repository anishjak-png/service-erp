"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fastGet, prefetchStaffCaches } from "@/lib/fast-fetch";

export type StaffRole = "reception" | "technician" | "admin" | "verifier";

type AuthState = {
  isLoggedIn: boolean;
  role: StaffRole | null;
  staffName: string | null;
  tenantName: string | null;
  technicianId: string | null;
  technicianName: string | null;
  deviceStatus: "pending" | "approved" | "revoked" | null;
  deviceApproved: boolean;
  pendingDeviceCount: number;
  unreadAlertCount: number;
  loaded: boolean;
};

type AuthContextValue = AuthState & {
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  role: null,
  staffName: null,
  tenantName: null,
  technicianId: null,
  technicianName: null,
  deviceStatus: null,
  deviceApproved: false,
  pendingDeviceCount: 0,
  unreadAlertCount: 0,
  loaded: false,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    role: null,
    staffName: null,
    tenantName: null,
    technicianId: null,
    technicianName: null,
    deviceStatus: null,
    deviceApproved: false,
    pendingDeviceCount: 0,
    unreadAlertCount: 0,
    loaded: false,
  });

  const refreshAuth = useCallback(async () => {
    try {
      const data = await fastGet<Record<string, unknown>>("/api/auth/me", {
        skipCache: true,
      });
      const next: AuthState = {
        isLoggedIn: Boolean(data.isLoggedIn),
        role: (data.role as StaffRole | null) ?? null,
        staffName: (data.staffName as string | null) ?? null,
        tenantName: (data.tenantName as string | null) ?? null,
        technicianId: (data.technicianId as string | null) ?? null,
        technicianName: (data.technicianName as string | null) ?? null,
        deviceStatus:
          (data.deviceStatus as AuthState["deviceStatus"]) ?? null,
        deviceApproved: Boolean(data.deviceApproved),
        pendingDeviceCount: Number(data.pendingDeviceCount ?? 0),
        unreadAlertCount: Number(data.unreadAlertCount ?? 0),
        loaded: true,
      };
      setAuth(next);
      if (next.isLoggedIn && next.deviceApproved) {
        prefetchStaffCaches();
      }
    } catch {
      setAuth((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return (
    <AuthContext.Provider value={{ ...auth, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
