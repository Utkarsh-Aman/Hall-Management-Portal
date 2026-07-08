"use client";

/**
 * Auth context — manages user session, login/logout, signup flow.
 * Includes retry logic for cold-start backends and keep-alive pings.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setAccessToken } from "@/lib/api";
import type {
  LoginResult,
  UserBrief,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** How many times to retry session restore on network/server error */
const RESTORE_MAX_RETRIES = 3;
/** Delay between retries in ms */
const RESTORE_RETRY_DELAY = 3000;
/** Keep-alive interval: 14 minutes (before Render's 15-min sleep) */
const KEEPALIVE_INTERVAL_MS = 14 * 60 * 1000;

interface AuthState {
  user: UserBrief | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when the backend seems to be cold-starting */
  serverWaking: boolean;
}

interface AuthContextType extends AuthState {
  login: (
    identifier: string,
    password: string
  ) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setUser: (user: UserBrief, token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Keep-alive ping — prevents Render from sleeping the backend
  useEffect(() => {
    const pingHealth = () => {
      fetch(`${API_BASE}/health`, { method: "GET" }).catch(() => {
        // Silently ignore — best-effort keepalive
      });
    };

    // Start pinging immediately and then every 14 minutes
    pingHealth();
    keepAliveRef.current = setInterval(pingHealth, KEEPALIVE_INTERVAL_MS);

    return () => {
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
      }
    };
  }, []);

  // Try to restore session from refresh token on mount
  useEffect(() => {
    const restoreSession = async () => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < RESTORE_MAX_RETRIES; attempt++) {
        try {
          // Attempt to refresh the access token using the httpOnly cookie
          const data = await apiFetch<{ access_token: string }>("/auth/refresh", {
            method: "POST",
            skipAuth: true,
          });
          setAccessToken(data.access_token);

          // Fetch full user info from /auth/me
          try {
            const userInfo = await apiFetch<UserBrief>("/auth/me");
            setUserState(userInfo);
          } catch {
            // Fallback: decode minimal info from JWT
            const payload = JSON.parse(atob(data.access_token.split(".")[1]));
            setUserState({
              id: parseInt(payload.sub),
              identifier: "",
              name: "",
              role: payload.role,
              email: null,
              roll_no: null,
              room_no: null,
            });
          }

          setServerWaking(false);
          setIsLoading(false);
          return; // Success — exit retry loop
        } catch (err: unknown) {
          lastError = err;
          const error = err as Error & { status?: number };

          // If it's a 401 (no valid refresh token), don't retry — user needs to log in
          if (error.status === 401) {
            setAccessToken(null);
            setUserState(null);
            setServerWaking(false);
            setIsLoading(false);
            return;
          }

          // Network error or server error (502, 503, etc.) — server might be cold-starting
          if (attempt < RESTORE_MAX_RETRIES - 1) {
            setServerWaking(true);
            await new Promise((resolve) => setTimeout(resolve, RESTORE_RETRY_DELAY));
          }
        }
      }

      // All retries exhausted — no valid session
      console.warn("Session restore failed after retries:", lastError);
      setAccessToken(null);
      setUserState(null);
      setServerWaking(false);
      setIsLoading(false);
    };
    restoreSession();
  }, []);

  const login = useCallback(
    async (identifier: string, password: string): Promise<LoginResult> => {
      const data = await apiFetch<LoginResult>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
        skipAuth: true,
      });

      // Check if it's a must-change-password response
      if ("must_change_password" in data && data.must_change_password) {
        return data;
      }

      // Normal login success
      const loginData = data as {
        access_token: string;
        user: UserBrief;
      };
      setAccessToken(loginData.access_token);
      setUserState(loginData.user);
      return data;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors during logout
    }
    setAccessToken(null);
    setUserState(null);
    router.push("/login");
  }, [router]);

  const setUser = useCallback((user: UserBrief, token: string) => {
    setAccessToken(token);
    setUserState(user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        serverWaking,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Helper to get the role-based home route.
 */
export function getRoleHome(role: string): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "mess_staff":
      return "/staff/items";
    case "mess_worker":
      return "/worker/scan";
    case "hall_office":
      return "/hall-office/roll-numbers";
    default:
      return "/login";
  }
}
