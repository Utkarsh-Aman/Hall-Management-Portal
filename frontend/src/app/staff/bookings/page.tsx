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
  
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split("T")[0];
  
  const [filterDate, setFilterDate] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [mealFilter, setMealFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const { toast } = useToast();

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      let url = "/staff/bookings";
      const params = new URLSearchParams();
      if (filterDate) params.set("date", filterDate);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, searchQuery]);

  const handleCancel = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await apiFetch(`/staff/bookings/${id}`, { method: "DELETE" });
      toast("Booking cancelled successfully.", "success");
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "cancelled" } : b));
    } catch (err: unknown) {
      toast((err as Error).message || "Failed to cancel booking.", "error");
    }
  };

  const handleServe = async (id: number) => {
    try {
      await apiFetch(`/staff/bookings/${id}/serve`, { method: "POST" });
      toast("Booking marked as served.", "success");
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: "served" } : b));
    } catch (err: unknown) {
      toast((err as Error).message || "Failed to mark as served.", "error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg font-bold text-text-primary mb-4">
        All Bookings
      </h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex bg-bg-surface p-1 rounded-xl border border-border w-fit">
          <button
            onClick={() => setFilterDate(todayStr)}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filterDate === todayStr 
                ? "bg-accent text-white shadow-md" 
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilterDate(tomorrowStr)}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filterDate === tomorrowStr 
                ? "bg-accent text-white shadow-md" 
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }`}
          >
            Tomorrow
          </button>
        </div>
        
        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            placeholder="Search Name or Roll No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent shadow-sm"
          >
            <option value="All">All Meals</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent shadow-sm"
          >
            <option value="All">All Statuses</option>
            <option value="booked">Booked</option>
            <option value="served">Served</option>
            <option value="missed">Missed</option>
            <option value="cancelled">Cancelled</option>
            <option value="cancel_requested">Cancel Requested</option>
          </select>
        </div>
      </div>
      
      {(() => {
        const filteredBookings = bookings.filter((b) => {
          if (mealFilter !== "All" && b.meal_type.toLowerCase() !== mealFilter.toLowerCase()) return false;
          if (statusFilter !== "All" && b.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
          return true;
        });

        return (
          <>

      {!isLoading && bookings.length > 0 && (
        <div className="mb-6 space-y-6">
          {/* Active Bookings (Window Open) */}
          {Object.keys(
            bookings.reduce((acc, b) => {
              if (new Date() <= new Date(b.closes_at) && b.status === "booked") {
                const key = `${b.meal_type.toUpperCase()} - ${b.item_name}`;
                acc[key] = (acc[key] || 0) + b.qty;
              }
              return acc;
            }, {} as Record<string, number>)
          ).length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider">Active Bookings (Still Open)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(
                  bookings.reduce((acc, b) => {
                    if (new Date() <= new Date(b.closes_at) && b.status === "booked") {
                      const key = `${b.meal_type.toUpperCase()} - ${b.item_name}`;
                      acc[key] = (acc[key] || 0) + b.qty;
                    }
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([mealKey, totalQty]) => (
                  <div key={mealKey} className="glass-card p-4 rounded-xl border-l-4 border-l-warning flex flex-col items-start shadow-sm">
                    <p className="text-xs font-semibold text-text-muted capitalize mb-1">{mealKey}</p>
                    <p className="text-2xl font-bold text-text-primary">{totalQty} <span className="text-sm font-normal text-text-secondary">pending</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finalized Targets (Window Closed) */}
          {Object.keys(
            bookings.reduce((acc, b) => {
              if (new Date() > new Date(b.closes_at) && b.status !== "cancelled") {
                const key = `${b.meal_type.toUpperCase()} - ${b.item_name}`;
                acc[key] = (acc[key] || 0) + b.qty;
              }
              return acc;
            }, {} as Record<string, number>)
          ).length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider">Preparation Targets (Finalized)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(
                  bookings.reduce((acc, b) => {
                    if (new Date() > new Date(b.closes_at) && b.status !== "cancelled") {
                      const key = `${b.meal_type.toUpperCase()} - ${b.item_name}`;
                      acc[key] = (acc[key] || 0) + b.qty;
                    }
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([mealKey, totalQty]) => (
                  <div key={mealKey} className="glass-card p-4 rounded-xl border-l-4 border-l-accent flex flex-col items-start shadow-sm">
                    <p className="text-xs font-semibold text-text-muted capitalize mb-1">{mealKey}</p>
                    <p className="text-2xl font-bold text-text-primary">{totalQty} <span className="text-sm font-normal text-text-secondary">locked in</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 animate-subtle-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-14 rounded-xl" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-text-muted text-sm">No bookings match the filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface shadow-sm">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-bg-elevated text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3 border-b border-border font-semibold">Meal</th>
                <th className="px-4 py-3 border-b border-border font-semibold">Item</th>
                <th className="px-4 py-3 border-b border-border font-semibold">Student</th>
                <th className="px-4 py-3 border-b border-border font-semibold">Roll No</th>
                <th className="px-4 py-3 border-b border-border font-semibold">Qty</th>
                <th className="px-4 py-3 border-b border-border font-semibold">Status</th>
                <th className="px-4 py-3 border-b border-border font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-bg-surface-hover transition-colors">
                  <td className="px-4 py-3 text-text-primary capitalize">{b.meal_type}</td>
                  <td className="px-4 py-3 text-text-primary font-bold">{b.item_name}</td>
                  <td className="px-4 py-3 text-text-primary">{b.student_name}</td>
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                    {b.student_identifier.includes('@') ? b.student_identifier.split('@')[0].toUpperCase() : b.student_identifier.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-text-primary font-semibold">{b.qty}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.status === "booked"
                          ? "bg-accent-bg text-accent"
                          : b.status === "cancelled"
                          ? "bg-error-bg text-error"
                          : b.status === "cancel_requested"
                          ? "bg-warning-bg text-warning"
                          : "bg-success-bg text-success"
                      }`}
                    >
                      {b.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(b.status === "booked" || b.status === "cancel_requested") && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleServe(b.id)}
                          className="px-3 py-1.5 rounded-lg border border-success/30 text-success bg-success/10 text-xs font-semibold hover:bg-success-bg transition-colors"
                        >
                          Serve
                        </button>
                        <button
                          onClick={() => handleCancel(b.id)}
                          className="px-3 py-1.5 rounded-lg border border-error/30 text-error bg-error/10 text-xs font-semibold hover:bg-error-bg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
    );
    })()}
    </div>
  );
}
