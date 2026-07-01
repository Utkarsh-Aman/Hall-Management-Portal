"use client";

/**
 * Auth context — manages user session, login/logout, signup flow.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setAccessToken } from "@/lib/api";
import type {
  LoginResult,
  UserBrief,
  isMustChangePassword,
} from "@/types";

interface AuthState {
  user: UserBrief | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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
  const router = useRouter();

  // Try to restore session from refresh token on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await apiFetch<{ access_token: string }>("/auth/refresh", {
          method: "POST",
          skipAuth: true,
        });
        setAccessToken(data.access_token);

        // Decode user info from the JWT payload
        const payload = JSON.parse(atob(data.access_token.split(".")[1]));
        // We need to fetch user info — for now, store minimal info from token
        setUserState({
          id: parseInt(payload.sub),
          identifier: "",
          name: "",
          role: payload.role,
        });
      } catch {
        // No valid refresh token — user needs to log in
        setAccessToken(null);
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
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
