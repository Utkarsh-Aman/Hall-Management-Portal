"use client";

/**
 * Root page — redirects to role-specific dashboard or login.
 * Shows a cold-start message if the backend is waking up.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getRoleHome } from "@/lib/auth";

export default function Home() {
  const { user, isLoading, serverWaking } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      router.replace(getRoleHome(user.role));
    } else {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  // Loading spinner while checking auth — with cold-start messaging
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4 max-w-xs text-center">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        {serverWaking ? (
          <>
            <p className="text-sm font-medium text-accent">
              Server is waking up…
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              The server goes to sleep after 15 minutes of inactivity.
              First load usually takes about 50 seconds. Hang tight!
            </p>
          </>
        ) : (
          <p className="text-sm text-text-muted">Loading…</p>
        )}
      </div>
    </div>
  );
}
