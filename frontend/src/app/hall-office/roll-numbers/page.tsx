"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { AllowedRollResponse, RollNumberUploadResponse } from "@/types";

export default function RollNumbersPage() {
  const [rolls, setRolls] = useState<AllowedRollResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // CSV Upload State
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Manual Add State
  const [isAdding, setIsAdding] = useState(false);
  const [newRoll, setNewRoll] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRoom, setNewRoom] = useState("");

  const { toast } = useToast();

  const fetchRolls = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch<AllowedRollResponse[]>("/hall-office/roll-numbers");
      setRolls(data);
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to fetch roll numbers", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRolls();
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast("Please select a .csv file.", "warning");
      return;
    }

    if (file.size > 1_048_576) {
      toast("File too large. Maximum size is 1MB.", "warning");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await apiFetch<RollNumberUploadResponse>(
        "/hall-office/roll-numbers/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      toast(data.message, "success");
      setFile(null);

      // Reset file input
      const input = document.getElementById("csv-input") as HTMLInputElement | null;
      if (input) input.value = "";
      
      // Refresh list
      fetchRolls();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Upload failed.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll.trim()) return;

    try {
      await apiFetch("/hall-office/roll-numbers", {
        method: "POST",
        body: JSON.stringify({
          roll_no: newRoll.trim(),
          name: newName.trim() || undefined,
          email: newEmail.trim() || undefined,
          room_number: newRoom.trim() || undefined,
        }),
      });

      toast(`Added ${newRoll.trim()}`, "success");
      setNewRoll("");
      setNewName("");
      setNewEmail("");
      setNewRoom("");
      setIsAdding(false);
      fetchRolls();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to add roll number", "error");
    }
  };

  const handleDelete = async (roll_no: string) => {
    if (!confirm(`Are you sure you want to delete ${roll_no}?`)) return;

    try {
      await apiFetch(`/hall-office/roll-numbers/${roll_no}`, {
        method: "DELETE",
      });
      toast(`Deleted ${roll_no}`, "success");
      fetchRolls();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to delete roll number", "error");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Manage Roll Numbers
        </h1>
        <p className="text-sm text-text-muted">
          Upload a CSV to bulk-replace all records, or manage individual records below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV Upload Card */}
        <div className="glass-card p-6 rounded-xl space-y-5">
          <h2 className="text-sm font-semibold text-text-primary">Bulk Upload CSV</h2>
          <p className="text-xs text-warning">
            ⚠ Uploading a CSV will <span className="font-bold">replace</span> all existing roll numbers.
          </p>
          <div>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white file:cursor-pointer hover:file:bg-accent-hover"
            />
            <p className="text-xs mt-2 text-text-muted">Format: Roll No, Name, Email, Room Number</p>
          </div>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full py-2.5 rounded-xl bg-warning hover:bg-warning/80 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading…" : "Upload & Replace All"}
          </button>
        </div>

        {/* Manual Add Card */}
        <div className="glass-card p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Manual Entry</h2>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="text-xs font-medium text-accent hover:text-accent-hover bg-accent/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              {isAdding ? "Cancel" : "+ Add Student"}
            </button>
          </div>
          
          {isAdding ? (
            <form onSubmit={handleManualAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Roll Number *"
                  required
                  value={newRoll}
                  onChange={(e) => setNewRoll(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Room Number"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors"
              >
                Save Student
              </button>
            </form>
          ) : (
            <div className="flex h-32 items-center justify-center border-2 border-dashed border-border rounded-xl">
              <p className="text-sm text-text-muted">Click "+ Add Student" to manually insert a record.</p>
            </div>
          )}
        </div>
      </div>

      {/* Allowed Rolls Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Uploaded Students ({rolls.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-bg-elevated/50 text-text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Roll No</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Room</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                    Loading records...
                  </td>
                </tr>
              ) : rolls.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted">
                    No roll numbers found. Upload a CSV to get started.
                  </td>
                </tr>
              ) : (
                rolls.map((r) => (
                  <tr key={r.roll_no} className="hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-text-primary">{r.roll_no}</td>
                    <td className="px-6 py-3 text-text-secondary">{r.name || "—"}</td>
                    <td className="px-6 py-3 text-text-secondary">{r.email || "—"}</td>
                    <td className="px-6 py-3 text-text-secondary">{r.room_number || "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(r.roll_no)}
                        className="text-error hover:text-error/80 font-medium px-3 py-1 bg-error/10 hover:bg-error/20 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
