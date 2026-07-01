"use client";

/**
 * Student profile page — basic info + logout.
 */

import React from "react";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-lg font-bold text-text-primary mb-6">Profile</h1>

      <div className="glass-card p-5 rounded-xl space-y-4">
        <div>
          <p className="text-xs text-text-muted mb-0.5">Name</p>
          <p className="text-sm font-medium text-text-primary">
            {user?.name || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-0.5">Email / ID</p>
          <p className="text-sm font-medium text-text-primary">
            {user?.identifier || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-0.5">Role</p>
          <p className="text-sm font-medium text-accent capitalize">
            {user?.role.replace("_", " ") || "—"}
          </p>
        </div>
      </div>

      <button
        onClick={logout}
        className="w-full mt-6 py-2.5 rounded-xl border border-error/30 text-error text-sm font-semibold hover:bg-error-bg transition-colors"
      >
        Logout
      </button>
    </div>
  );
}
