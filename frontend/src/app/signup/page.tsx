"use client";

/**
 * Student signup — multi-step: roll+email → OTP verification → set password.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

type Step = "details" | "otp" | "password";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("details");
  const [rollNo, setRollNo] = useState("");
  const [otp, setOtp] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Step 1: Request OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo.trim()) return;

    setIsSubmitting(true);
    try {
      await apiFetch("/auth/signup/request-otp", {
        method: "POST",
        body: JSON.stringify({
          roll_no: rollNo.trim(),
        }),
        skipAuth: true,
      });
      toast("OTP sent to your email!", "success");
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
      const data = await apiFetch<{ signup_token: string }>(
        "/auth/signup/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({
            roll_no: rollNo.trim(),
            otp,
          }),
          skipAuth: true,
        }
      );
      setSignupToken(data.signup_token);
      toast("OTP verified!", "success");
      setStep("password");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Invalid OTP.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Set password
  const handleSetPassword = async (e: React.FormEvent) => {
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
      const data = await apiFetch<{
        access_token: string;
        user: { id: number; identifier: string; name: string; role: string };
      }>("/auth/signup/set-password", {
        method: "POST",
        body: JSON.stringify({
          signup_token: signupToken,
          password,
        }),
        skipAuth: true,
      });

      setUser(
        {
          id: data.user.id,
          identifier: data.user.identifier,
          name: data.user.name,
          role: data.user.role as "student",
        },
        data.access_token
      );

      toast("Account created! Welcome to Hall 12.", "success");
      router.push("/student/dashboard");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to set password.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step indicators
  const steps = ["Details", "Verify", "Password"];
  const currentIdx = step === "details" ? 0 : step === "otp" ? 1 : 2;

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
            Student Signup
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
        {step === "details" && (
          <form
            onSubmit={handleRequestOTP}
            className="glass-card p-6 space-y-5 animate-fade-in"
          >
            <div>
              <label
                htmlFor="roll-no"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                Roll Number
              </label>
              <input
                id="roll-no"
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g. 230001"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Sending OTP…" : "Send OTP"}
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <form
            onSubmit={handleVerifyOTP}
            className="glass-card p-6 space-y-5 animate-fade-in"
          >
            <p className="text-sm text-text-secondary text-center">
              Enter the 6-digit code sent to{" "}
              <span className="text-accent font-medium">{rollNo.trim().toLowerCase()}@iitk.ac.in</span>
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
              {isSubmitting ? "Verifying…" : "Verify OTP"}
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {/* Step 3: Password */}
        {step === "password" && (
          <form
            onSubmit={handleSetPassword}
            className="glass-card p-6 space-y-5 animate-fade-in"
          >
            <p className="text-sm text-text-secondary text-center">
              Set a password for your account.
            </p>
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                Password (min 8 characters)
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
              {isSubmitting ? "Creating Account…" : "Create Account"}
            </button>
          </form>
        )}

        {/* Login link */}
        <p className="text-center text-sm text-text-muted mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-accent hover:text-accent-hover transition-colors font-medium"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
