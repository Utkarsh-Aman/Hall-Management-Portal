"use client";

/**
 * Booking history — lists all bookings with QR code viewer.
 */

import React, { useEffect, useState } from "react";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatPrice } from "@/lib/utils";
import Image from "next/image";
import type { Booking, BookingListResponse } from "@/types";

export default function HistoryPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [runningTotal, setRunningTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [qrBookingId, setQrBookingId] = useState<number | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await apiFetch<BookingListResponse>("/bookings/me");
        setBookings(data.bookings);
        setRunningTotal(data.running_total);
      } catch (err: unknown) {
        const error = err as Error;
        toast(error.message || "Failed to load bookings.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();
  }, [toast]);

  const showQR = async (bookingId: number) => {
    setQrBookingId(bookingId);
    try {
      const blob = await apiFetchBlob(`/bookings/${bookingId}/qr`);
      const url = URL.createObjectURL(blob);
      setQrImageUrl(url);
    } catch {
      toast("Failed to load QR code.", "error");
      setQrBookingId(null);
    }
  };

  const closeQR = () => {
    if (qrImageUrl) URL.revokeObjectURL(qrImageUrl);
    setQrBookingId(null);
    setQrImageUrl(null);
  };

  const handleCancel = async (bookingId: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      await apiFetch(`/bookings/${bookingId}`, { method: "DELETE" });
      toast("Booking cancelled successfully.", "success");
      const data = await apiFetch<BookingListResponse>("/bookings/me");
      setBookings(data.bookings);
      setRunningTotal(data.running_total);
    } catch (err: unknown) {
      toast((err as Error).message || "Failed to cancel booking.", "error");
    }
  };

  const handleRequestCancel = async (bookingId: number) => {
    if (!confirm("The booking window has closed. Do you want to request the mess staff to cancel it?")) return;
    try {
      await apiFetch(`/bookings/${bookingId}/request-cancel`, { method: "POST" });
      toast("Cancellation requested.", "success");
      const data = await apiFetch<BookingListResponse>("/bookings/me");
      setBookings(data.bookings);
      setRunningTotal(data.running_total);
    } catch (err: unknown) {
      toast((err as Error).message || "Failed to request cancellation.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-subtle-pulse">
        <div className="glass-card h-16 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Running total */}
      <div className="glass-card p-4 rounded-xl mb-4 flex items-center justify-between">
        <span className="text-sm text-text-muted">Running Bill</span>
        <span className="text-xl font-bold text-accent">
          {formatPrice(runningTotal)}
        </span>
      </div>

      <h1 className="text-lg font-bold text-text-primary mb-4">
        Booking History
      </h1>

      {bookings.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-text-muted text-sm">
            No bookings yet. Browse extras to place your first order!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="relative overflow-hidden glass-card p-5 rounded-2xl flex items-center justify-between gap-4 border border-white/5 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              {b.status === "booked" && (
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none group-hover:bg-accent/20 transition-colors" />
              )}
              
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-text-primary truncate">
                    {b.item_name}
                  </h3>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-lg tracking-wider ${
                      b.status === "booked"
                        ? "bg-accent/20 text-accent border border-accent/20"
                        : b.status === "cancelled" || b.status === "cancel_requested" 
                        ? "bg-error/20 text-error border border-error/20"
                        : "bg-success/20 text-success border border-success/20"
                    }`}
                  >
                    {b.status.toUpperCase()}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-text-secondary">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="text-text-primary">{b.qty}</span> Portion{b.qty > 1 ? 's' : ''}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-border" />
                  <div className="font-bold text-accent">
                    {formatPrice(b.total_price)}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-border" />
                  <div className="text-xs text-text-muted">
                    {new Date(b.booked_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>

              {(b.status === "booked" || b.status === "cancel_requested") && (
                <div className="flex flex-col gap-2 flex-shrink-0 relative z-10">
                  <button
                    onClick={() => showQR(b.id)}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95"
                  >
                    Show QR
                  </button>
                  {b.status === "booked" && (
                    new Date() < new Date(b.closes_at) ? (
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="px-4 py-2 rounded-xl border border-error/30 text-error text-xs font-bold hover:bg-error/10 transition-colors"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequestCancel(b.id)}
                        className="px-4 py-2 rounded-xl border border-warning/30 text-warning text-xs font-bold hover:bg-warning/10 transition-colors"
                      >
                        Req Cancel
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeQR}
          />
          <div className="relative glass-card p-6 rounded-2xl animate-fade-in flex flex-col items-center max-w-xs mx-4">
            <h2 className="text-base font-bold text-text-primary mb-4">
              Your QR Code
            </h2>
            {qrImageUrl ? (
              <img
                src={qrImageUrl}
                alt="Booking QR Code"
                className="w-48 h-48 rounded-xl bg-white p-2"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            )}
            <p className="text-xs text-text-muted mt-3 text-center">
              Show this to the mess worker when collecting your order.
            </p>
            <button
              onClick={closeQR}
              className="mt-4 w-full py-2 rounded-xl border border-border text-text-secondary text-sm font-medium hover:bg-bg-surface-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
