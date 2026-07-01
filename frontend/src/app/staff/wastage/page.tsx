"use client";

/**
 * Mess staff — wastage entry form + history.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { WastageLog } from "@/types";

export default function StaffWastagePage() {
  const [logs, setLogs] = useState<WastageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state — pre-filled for today
  const today = new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState(today);
  const [bdmr, setBdmr] = useState("");
  const [plainWastage, setPlainWastage] = useState("");
  const [plateWastage, setPlateWastage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const fetchLogs = async () => {
    try {
      const data = await apiFetch<WastageLog[]>("/staff/wastage");
      setLogs(data);

      // Pre-fill if today's entry exists
      const todayEntry = data.find((l) => l.date === today);
      if (todayEntry) {
        setBdmr(String(todayEntry.bdmr));
        setPlainWastage(String(todayEntry.plain_wastage));
        setPlateWastage(String(todayEntry.plate_wastage));
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to load wastage.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await apiFetch("/staff/wastage", {
        method: "POST",
        body: JSON.stringify({
          date: formDate,
          bdmr: parseFloat(bdmr),
          plain_wastage: parseFloat(plainWastage),
          plate_wastage: parseFloat(plateWastage),
        }),
      });
      toast("Wastage entry saved.", "success");
      fetchLogs();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to save.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Entry form */}
      <section>
        <h1 className="text-lg font-bold text-text-primary mb-4">
          Daily Wastage Entry
        </h1>

        <form
          onSubmit={handleSubmit}
          className="glass-card p-5 rounded-xl space-y-4"
        >
          <div>
            <label className="block text-xs text-text-secondary mb-1">Date</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">BDMR</label>
              <input
                type="number"
                step="0.01"
                value={bdmr}
                onChange={(e) => setBdmr(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Plain Wastage</label>
              <input
                type="number"
                step="0.01"
                value={plainWastage}
                onChange={(e) => setPlainWastage(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Plate Wastage</label>
              <input
                type="number"
                step="0.01"
                value={plateWastage}
                onChange={(e) => setPlateWastage(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save Entry"}
          </button>
        </form>
      </section>

      {/* History */}
      <section>
        <h2 className="text-base font-bold text-text-primary mb-3">
          Wastage History
        </h2>

        {isLoading ? (
          <div className="space-y-2 animate-subtle-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-14 rounded-xl" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-text-muted">No entries yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="glass-card p-3.5 rounded-xl"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-text-primary">
                    {formatDate(log.date)}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {formatDateTime(log.entered_at)}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-text-muted">
                  <span>
                    BDMR: <strong className="text-text-secondary">{log.bdmr}</strong>
                  </span>
                  <span>
                    Plain: <strong className="text-text-secondary">{log.plain_wastage}</strong>
                  </span>
                  <span>
                    Plate: <strong className="text-text-secondary">{log.plate_wastage}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
