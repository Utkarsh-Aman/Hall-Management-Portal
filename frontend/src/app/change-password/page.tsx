"use client";

/**
 * Forced password change page — for staff accounts on first login.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { useAuth, getRoleHome } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast("Password must be at least 8 characters.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match.", "warning");
      return;
    }

    const changeToken = sessionStorage.getItem("change_token");
    if (!changeToken) {
      toast("Session expired. Please log in again.", "error");
      router.push("/login");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{
        access_token: string;
        user: { id: number; identifier: string; name: string; role: string };
      }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          change_token: changeToken,
          new_password: newPassword,
        }),
        skipAuth: true,
      });

      sessionStorage.removeItem("change_token");

      setUser(
        {
          id: data.user.id,
          identifier: data.user.identifier,
          name: data.user.name,
          role: data.user.role as "mess_staff" | "mess_worker",
        },
        data.access_token
      );

      toast("Password changed! Welcome.", "success");
      router.push(getRoleHome(data.user.role));
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to change password.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/logo.webp"
            alt="Hall 12 Marathas"
            width={64}
            height={64}
            className="rounded-2xl mb-3"
            priority
          />
          <h1 className="text-lg font-bold text-text-primary">
            Change Password
          </h1>
          <p className="text-sm text-text-muted mt-1 text-center">
            You must set a new password before continuing.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card p-6 space-y-5 animate-fade-in"
        >
          <div>
            <label
              htmlFor="new-pwd"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              New Password (min 8 characters)
            </label>
            <input
              id="new-pwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-pwd"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-pwd"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Set New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
