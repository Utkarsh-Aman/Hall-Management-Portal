"use client";

/**
 * Student Setup - Step 1: Roll No + Setup Code → Step 2: Set password & details.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import type { LoginResponse } from "@/types";

type Step = "verify" | "password";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("verify");
  const [rollNo, setRollNo] = useState("");
  const [setupCode, setSetupCode] = useState("");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [email, setEmail] = useState(""); // purely for display
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Step 1: Verify Setup Code
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo.trim() || setupCode.length !== 8) return;

    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ name?: string; room_no?: string; email?: string }>(
        "/auth/setup/verify",
        {
          method: "POST",
          body: JSON.stringify({
            roll_no: rollNo.trim(),
            setup_code: setupCode.trim(),
          }),
          skipAuth: true,
        }
      );
      
      if (data.name) setName(data.name);
      if (data.room_no) setRoomNo(data.room_no);
      if (data.email) setEmail(data.email);
      
      toast("Setup code verified!", "success");
      setStep("password");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Invalid setup code.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Set password
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
    if (!name.trim()) {
      toast("Name is required.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await apiFetch<LoginResponse>("/auth/setup/complete", {
        method: "POST",
        body: JSON.stringify({
          roll_no: rollNo.trim(),
          setup_code: setupCode.trim(),
          password,
          name: name.trim(),
          room_no: roomNo.trim() || null,
        }),
        skipAuth: true,
      });

      setUser(data.user, data.access_token);

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
  const steps = ["Verify Code", "Profile"];
  const currentIdx = step === "verify" ? 0 : 1;

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
            Student Account Setup
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

        {/* Step 1: Verify Code */}
        {step === "verify" && (
          <form
            onSubmit={handleVerify}
            className="glass-card p-6 space-y-5 animate-fade-in"
          >
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Roll Number
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g. 230001"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Setup Code (8 characters)
              </label>
              <input
                type="text"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="ABC123XY"
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors tracking-widest font-mono uppercase"
                required
              />
              <p className="text-xs text-text-muted mt-2">
                Check your email for the setup code provided by the Hall Office.
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || setupCode.length !== 8 || !rollNo}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Verifying…" : "Verify Code"}
            </button>
          </form>
        )}

        {/* Step 2: Password */}
        {step === "password" && (
          <form
            onSubmit={handleSetPassword}
            className="glass-card p-6 space-y-4 animate-fade-in"
          >
            <p className="text-sm text-text-secondary text-center mb-2">
              Complete your profile and set a password.
            </p>
            
            {email && (
              <div className="bg-bg-elevated/50 p-3 rounded-lg border border-border">
                <p className="text-xs text-text-muted">Registered Email</p>
                <p className="text-sm font-medium text-text-primary">{email}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Room Number
                </label>
                <input
                  type="text"
                  value={roomNo}
                  onChange={(e) => setRoomNo(e.target.value)}
                  placeholder="e.g. A-101"
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
                />
              </div>
            </div>
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
            <button
              type="button"
              onClick={() => setStep("verify")}
              className="w-full py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              ← Back
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
