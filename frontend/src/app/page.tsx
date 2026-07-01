"use client";

/**
 * Root page — redirects to role-specific dashboard or login.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getRoleHome } from "@/lib/auth";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      router.replace(getRoleHome(user.role));
    } else {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  // Loading spinner while checking auth
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-text-muted">Loading…</p>
      </div>
    </div>
  );
}
