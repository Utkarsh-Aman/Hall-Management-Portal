"use client";

/**
 * Today's booking queue — fallback for when the scanner can't be used.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime } from "@/lib/utils";
import type { TodayBooking } from "@/types";

export default function QueuePage() {
  const [bookings, setBookings] = useState<TodayBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [servingId, setServingId] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchQueue = async () => {
    try {
      const data = await apiFetch<TodayBooking[]>("/worker/bookings/today");
      setBookings(data);
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to load queue.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleMarkServed = async (qrToken: string, id: number) => {
    setServingId(id);
    try {
      await apiFetch("/worker/scan", {
        method: "POST",
        body: JSON.stringify({ qr_token: qrToken }),
      });
      toast("Marked as served!", "success");
      fetchQueue();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to mark served.", "error");
    } finally {
      setServingId(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-text-primary">
          Today&apos;s Queue
        </h1>
        <Link
          href="/worker/scan"
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          ← Scanner
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-subtle-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-16 rounded-xl" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-text-muted text-sm">
            No pending bookings for today.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="glass-card p-3.5 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary truncate">
                  {b.item_name}
                </h3>
                <p className="text-xs text-text-muted">
                  {b.student_identifier} · {b.qty}× ·{" "}
                  {formatDateTime(b.booked_at)}
                </p>
              </div>
              <button
                onClick={() => handleMarkServed(b.qr_token, b.id)}
                disabled={servingId === b.id}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors min-h-[44px] disabled:opacity-50"
              >
                {servingId === b.id ? "…" : "Serve"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={fetchQueue}
        className="w-full mt-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-surface-hover transition-colors"
      >
        Refresh
      </button>
    </div>
  );
}
