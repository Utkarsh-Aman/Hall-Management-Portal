"use client";

/**
 * Browse extras — view available items and book with quantity selector.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatTime, formatPrice } from "@/lib/utils";
import type { Booking, ExtrasItem } from "@/types";

export default function BrowsePage() {
  const [items, setItems] = useState<ExtrasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingItem, setBookingItem] = useState<ExtrasItem | null>(null);
  const [qty, setQty] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const data = await apiFetch<ExtrasItem[]>("/items");
        setItems(data);
      } catch (err: unknown) {
        const error = err as Error;
        toast(error.message || "Failed to load items.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [toast]);

  const handleBook = async () => {
    if (!bookingItem) return;

    setIsBooking(true);
    try {
      await apiFetch<Booking>("/bookings", {
        method: "POST",
        body: JSON.stringify({
          item_id: bookingItem.id,
          qty,
        }),
      });
      toast(
        `Booked ${qty}× ${bookingItem.name}! View QR in History.`,
        "success"
      );
      setBookingItem(null);
      setQty(1);
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Booking failed.", "error");
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-subtle-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-text-primary mb-4">
        Extras Menu
      </h1>

      {items.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-text-muted text-sm">
            No extras available right now. Check back later!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass-card p-4 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-text-primary truncate">
                  {item.name}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatTime(item.opens_at)} – {formatTime(item.closes_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-bold text-accent">
                  {formatPrice(item.price)}
                </span>
                <button
                  onClick={() => {
                    setBookingItem(item);
                    setQty(1);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
                >
                  Book
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      {bookingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setBookingItem(null)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 glass-card p-6 rounded-2xl animate-fade-in">
            <h2 className="text-base font-bold text-text-primary mb-1">
              {bookingItem.name}
            </h2>
            <p className="text-sm text-text-muted mb-5">
              {formatPrice(bookingItem.price)} each · {formatTime(bookingItem.opens_at)} – {formatTime(bookingItem.closes_at)}
            </p>

            {/* Quantity selector */}
            <div className="flex items-center justify-center gap-4 mb-5">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 rounded-xl bg-bg-elevated border border-border text-text-primary font-bold text-lg hover:border-accent transition-colors"
              >
                −
              </button>
              <span className="text-2xl font-bold text-text-primary min-w-[3ch] text-center">
                {qty}
              </span>
              <button
                onClick={() => setQty(Math.min(10, qty + 1))}
                className="w-10 h-10 rounded-xl bg-bg-elevated border border-border text-text-primary font-bold text-lg hover:border-accent transition-colors"
              >
                +
              </button>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mb-5 px-2">
              <span className="text-sm text-text-muted">Total</span>
              <span className="text-lg font-bold text-accent">
                {formatPrice(bookingItem.price * qty)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setBookingItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm font-medium hover:bg-bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={isBooking}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isBooking ? "Booking…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
