"use client";

/**
 * Student layout — header + content + bottom nav.
 */

import React, { useEffect } from "react";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, serverWaking } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          {serverWaking && (
            <>
              <p className="text-sm font-medium text-accent">Server is waking up…</p>
              <p className="text-xs text-text-muted leading-relaxed">
                The server goes to sleep after 15 min of inactivity. First load takes ~50 seconds.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-4 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
