"use client";

/**
 * Staff account creation + listing page for hall_office.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import type { StaffAccount, StaffCreateResponse } from "@/types";

export default function StaffAccountsPage() {
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create form
  const [name, setName] = useState("");
  const [role, setRole] = useState<"mess_staff" | "mess_worker">("mess_staff");
  const [isCreating, setIsCreating] = useState(false);
  const [createdAccount, setCreatedAccount] =
    useState<StaffCreateResponse | null>(null);

  const { toast } = useToast();

  const fetchStaff = async () => {
    try {
      const data = await apiFetch<StaffAccount[]>("/hall-office/staff");
      setStaffList(data);
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to load staff.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const data = await apiFetch<StaffCreateResponse>("/hall-office/staff", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), role }),
      });

      setCreatedAccount(data);
      setName("");
      toast("Account created!", "success");
      fetchStaff();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to create account.", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    try {
      await apiFetch(`/hall-office/staff/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !isActive }),
      });
      toast(
        `Account ${!isActive ? "activated" : "deactivated"}.`,
        "success"
      );
      fetchStaff();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to update.", "error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard!", "info");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Create account form */}
      <section>
        <h1 className="text-lg font-bold text-text-primary mb-4">
          Create Staff Account
        </h1>

        <form
          onSubmit={handleCreate}
          className="glass-card p-5 rounded-xl space-y-4"
        >
          <div>
            <label
              htmlFor="staff-name"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Full Name
            </label>
            <input
              id="staff-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter staff member name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
            />
          </div>
          <div>
            <label
              htmlFor="staff-role"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Role
            </label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "mess_staff" | "mess_worker")
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow transition-colors"
            >
              <option value="mess_staff">Mess Staff (management)</option>
              <option value="mess_worker">Mess Worker (scanner)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {isCreating ? "Creating…" : "Create Account"}
          </button>
        </form>
      </section>

      {/* Newly created account — temp password display */}
      {createdAccount && (
        <div className="glass-card p-5 rounded-xl border-warning/30 bg-warning-bg animate-fade-in">
          <h3 className="text-sm font-bold text-warning mb-3">
            ⚠ Account Created — Save This Password
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Staff ID:</span>
              <span className="font-mono font-bold text-text-primary">
                {createdAccount.identifier}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Name:</span>
              <span className="text-text-primary">{createdAccount.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Role:</span>
              <span className="text-text-primary capitalize">
                {createdAccount.role.replace("_", " ")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Temp Password:</span>
              <div className="flex items-center gap-2">
                <code className="font-mono font-bold text-accent bg-bg-primary px-2 py-1 rounded-lg">
                  {createdAccount.temp_password}
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(createdAccount.temp_password)
                  }
                  className="text-xs text-accent hover:text-accent-hover"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-warning/80 mt-3">
            This password will not be shown again. Share it securely.
          </p>
          <button
            onClick={() => setCreatedAccount(null)}
            className="mt-3 text-xs text-text-muted hover:text-text-secondary"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Staff list */}
      <section>
        <h2 className="text-base font-bold text-text-primary mb-3">
          Existing Accounts
        </h2>

        {isLoading ? (
          <div className="space-y-2 animate-subtle-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-14 rounded-xl" />
            ))}
          </div>
        ) : staffList.length === 0 ? (
          <p className="text-sm text-text-muted">
            No staff accounts created yet.
          </p>
        ) : (
          <div className="space-y-2">
            {staffList.map((s) => (
              <div
                key={s.id}
                className="glass-card p-3.5 rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {s.name}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-bg-elevated text-text-muted capitalize">
                      {s.role.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {s.identifier} · Created {formatDateTime(s.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(s.id, s.is_active)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    s.is_active
                      ? "bg-success-bg text-success hover:bg-success/20"
                      : "bg-error-bg text-error hover:bg-error/20"
                  }`}
                >
                  {s.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
