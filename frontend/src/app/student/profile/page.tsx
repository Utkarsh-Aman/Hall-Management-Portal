"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match.", "error");
      return;
    }
    
    if (newPassword.length < 8) {
      toast("Password must be at least 8 characters.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });
      toast("Password changed successfully!", "success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to change password.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Profile</h1>
      
      {user && (
        <div className="glass-card p-6 space-y-4 rounded-xl">
          <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">
            Personal Details
          </h2>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-text-muted">Name</p>
              <p className="text-sm font-semibold text-text-primary">{user.name || "N/A"}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-text-muted">Roll Number</p>
                <p className="text-sm font-semibold text-text-primary">{user.roll_no || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted">Room Number</p>
                <p className="text-sm font-semibold text-text-primary">{user.room_no || "N/A"}</p>
              </div>
            </div>
            
            <div>
              <p className="text-xs font-medium text-text-muted">Email</p>
              <p className="text-sm font-semibold text-text-primary">{user.email || user.identifier || "N/A"}</p>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-6 space-y-5 rounded-xl">
        <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">
          Change Password
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
              minLength={8}
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors"
              required
              minLength={8}
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50 mt-4"
          >
            {isSubmitting ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
