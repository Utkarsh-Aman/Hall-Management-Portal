"use client";

/**
 * Forgot Password flow.
 * Step 1: Email → Request OTP
 * Step 2: Verify OTP
 * Step 3: Set new password
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth, getRoleHome } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import type { LoginResponse } from "@/types";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Step 1: Request OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      await apiFetch("/auth/forgot-password/request-otp", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
        }),
        skipAuth: true,
      });
      toast("If the email is registered, an OTP has been sent.", "success");
      setStep("otp");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to send OTP.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ reset_token: string }>(
        "/auth/forgot-password/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            otp,
          }),
          skipAuth: true,
        }
      );
      setResetToken(data.reset_token);
      toast("OTP verified!", "success");
      setStep("password");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Invalid OTP.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast("Password must be at least 8 characters.", "warning");
      return;
    }
    if (password !== confirmPassword) {
      toast("Passwords do not match.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch<LoginResponse>("/auth/forgot-password/reset-password", {
        method: "POST",
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: password,
        }),
        skipAuth: true,
      });

      setUser(data.user, data.access_token);

      toast("Password reset successfully!", "success");
      router.push(getRoleHome(data.user.role));
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to reset password.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step indicators
  const steps = ["Email", "Verify", "New Password"];
  const currentIdx = step === "email" ? 0 : step === "otp" ? 1 : 2;

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
            Forgot Password
          </h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i <= currentIdx
                    ? "bg-accent text-white"
                    : "bg-bg-surface text-text-muted border border-border"
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 rounded-full transition-colors ${
                    i < currentIdx ? "bg-accent" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Details */}
        {step === "email" && (
          <form
            onSubmit={handleRequestOTP}
            className="glass-card p-6 space-y-5 animate-fade-in"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                Registered Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. utkarsh24@iitk.ac.in"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Sending OTP…" : "Send Reset Code"}
            </button>
            
            <p className="text-center text-sm text-text-muted mt-4">
              <Link
                href="/login"
                className="text-accent hover:text-accent-hover transition-colors font-medium"
              >
                Back to Login
              </Link>
            </p>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <form
            onSubmit={handleVerifyOTP}
            className="glass-card p-6 space-y-5 animate-fade-in"
          >
            <p className="text-sm text-text-secondary text-center">
              Enter the 6-digit reset code sent to{" "}
              <span className="text-accent font-medium">{email.trim().toLowerCase()}</span>
            </p>
            <div>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="w-full px-3.5 py-3 rounded-xl bg-bg-elevated border border-border text-center text-2xl font-mono tracking-[0.3em] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Verifying…" : "Verify Code"}
            </button>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {/* Step 3: Password */}
        {step === "password" && (
          <form
            onSubmit={handleResetPassword}
            className="glass-card p-6 space-y-4 animate-fade-in"
          >
            <p className="text-sm text-text-secondary text-center mb-2">
              Set your new password.
            </p>
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                New Password (min 8 characters)
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
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
              {isSubmitting ? "Resetting…" : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
