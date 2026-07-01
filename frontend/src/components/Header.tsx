"use client";

import React from "react";

/**
 * Header component — logo, portal name, and logout button.
 */
import { useAuth } from "@/lib/auth";
import Image from "next/image";

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo + title */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo.webp"
            alt="Hall 12 Marathas"
            width={36}
            height={36}
            className="rounded-lg"
            priority
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary leading-tight">
              Hall 12 — Marathas
            </span>
            {user && (
              <span className="text-[11px] text-text-muted leading-tight capitalize">
                {user.role.replace("_", " ")}
                {user.name ? ` · ${user.name}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Logout */}
        {user && (
          <button
            onClick={logout}
            id="logout-btn"
            className="text-xs text-text-secondary hover:text-accent transition-colors px-3 py-1.5 rounded-lg hover:bg-bg-surface"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
