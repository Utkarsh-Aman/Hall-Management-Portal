"use client";

/**
 * Booking history — lists all bookings with QR code viewer.
 */

import React, { useEffect, useState } from "react";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatPrice } from "@/lib/utils";
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
        <div className="space-y-2">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="glass-card p-3.5 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-text-primary truncate">
                    {b.item_name}
                  </h3>
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
                  {b.qty}× · {formatPrice(b.total_price)} ·{" "}
                  {formatDateTime(b.booked_at)}
                </p>
              </div>

              {b.status === "booked" && (
                <button
                  onClick={() => showQR(b.id)}
                  className="px-3 py-1.5 rounded-lg border border-accent/30 text-accent text-xs font-semibold hover:bg-accent-bg transition-colors flex-shrink-0"
                >
                  QR
                </button>
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
