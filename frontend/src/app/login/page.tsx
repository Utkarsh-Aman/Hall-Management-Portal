"use client";

/**
 * Login page — shared by all roles.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth, getRoleHome } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { isMustChangePassword } from "@/types";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;

    setIsSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);

      if (isMustChangePassword(result)) {
        // Staff needs to change temp password
        sessionStorage.setItem("change_token", result.change_token);
        router.push("/change-password");
        return;
      }

      toast("Logged in successfully!", "success");
      router.push(getRoleHome(result.user.role));
    } catch (err: unknown) {
      const error = err as Error & { status?: number };
      if (error.status === 429) {
        toast("Too many attempts. Please wait 15 minutes.", "error");
      } else {
        toast(error.message || "Invalid credentials.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo + title */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.webp"
            alt="Hall 12 Marathas"
            width={80}
            height={80}
            className="rounded-2xl mb-4"
            priority
          />
          <h1 className="text-xl font-bold text-text-primary">
            Hall 12 — Marathas
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Hall Management Portal
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
          <div>
            <label
              htmlFor="identifier"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Email / Staff ID
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 230001@iitk.ac.in or MS-001"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            id="login-submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Logging in…" : "Login"}
          </button>
        </form>

        {/* Signup link */}
        <p className="text-center text-sm text-text-muted mt-6">
          Student?{" "}
          <Link
            href="/signup"
            className="text-accent hover:text-accent-hover transition-colors font-medium"
          >
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
