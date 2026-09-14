"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { fastGet, prefetchStaffCaches, invalidateFastCache } from "@/lib/fast-fetch";

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

const AUTH_STORAGE_KEY = "erp-auth-v1";

const emptyAuth: AuthState = {
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
};

function readAuthCache(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed.isLoggedIn || !parsed.role) return null;
    return { ...parsed, loaded: true };
  } catch {
    return null;
  }
}

function writeAuthCache(state: AuthState) {
  if (typeof window === "undefined") return;
  try {
    if (state.isLoggedIn && state.role) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

const AuthContext = createContext<AuthContextValue>({
  ...emptyAuth,
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => readAuthCache() ?? emptyAuth);

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
      writeAuthCache(next);
      if (next.isLoggedIn && next.deviceApproved) {
        prefetchStaffCaches();
      } else {
        invalidateFastCache();
      }
    } catch {
      setAuth((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
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
