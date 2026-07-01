"use client";

/**
 * Mess staff — all bookings table, filterable by date and item.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatPrice } from "@/lib/utils";
import type { StaffBooking } from "@/types";

export default function StaffBookingsPage() {
  const [bookings, setBookings] = useState<StaffBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const { toast } = useToast();

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      let url = "/staff/bookings";
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (params.toString()) url += `?${params.toString()}`;

      const data = await apiFetch<StaffBooking[]>(url);
      setBookings(data);
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to load bookings.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [filterDate]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg font-bold text-text-primary mb-4">
        All Bookings
      </h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Filter by date</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
          />
        </div>
        {filterDate && (
          <button
            onClick={() => setFilterDate("")}
            className="self-end px-3 py-2 rounded-xl border border-border text-text-muted text-sm hover:bg-bg-surface-hover transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 animate-subtle-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-14 rounded-xl" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-text-muted text-sm">No bookings found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="glass-card p-3.5 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-text-primary truncate">
                    {b.item_name}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      b.status === "booked"
                        ? "bg-accent-bg text-accent"
                        : "bg-success-bg text-success"
                    }`}
                  >
                    {b.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {b.student_identifier} · {b.qty}× ·{" "}
                  {formatPrice(b.total_price)} ·{" "}
                  {formatDateTime(b.booked_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
