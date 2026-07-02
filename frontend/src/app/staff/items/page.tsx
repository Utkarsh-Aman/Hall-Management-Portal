"use client";

/**
 * Mess staff — extras items CRUD.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatTime, formatPrice, parseApiDate } from "@/lib/utils";
import type { ExtrasItem } from "@/types";

export default function StaffItemsPage() {
  const [items, setItems] = useState<ExtrasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formMealType, setFormMealType] = useState("lunch");
  const [formCloses, setFormCloses] = useState("14:30");
  const [formRecurring, setFormRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [bulkDeleteId, setBulkDeleteId] = useState<number | null>(null);
  const [bulkDeletePassword, setBulkDeletePassword] = useState("");
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const { toast } = useToast();

  const fetchItems = async () => {
    try {
      const data = await apiFetch<ExtrasItem[]>("/staff/items");
      setItems(data);
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to load items.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormPrice("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormMealType("lunch");
    setFormCloses("14:30");
    setFormRecurring(false);
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (item: ExtrasItem) => {
    setFormName(item.name);
    setFormPrice(String(item.price));
    setFormDate(item.date);
    setFormMealType(item.meal_type);
    
    // Extract HH:MM from ISO string closes_at
    let closesTime = "14:30";
    if (item.closes_at) {
      const d = parseApiDate(item.closes_at);
      closesTime = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
    setFormCloses(closesTime);
    setFormRecurring(item.is_recurring);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Construct ISO datetime string for closes_at using local time
    const closesDt = new Date(`${formDate}T${formCloses}:00`);

    const body = {
      name: formName.trim(),
      price: parseFloat(formPrice),
      date: formDate,
      meal_type: formMealType,
      closes_at: closesDt.toISOString(),
      is_recurring: formRecurring,
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiFetch(`/staff/items/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        toast("Item updated.", "success");
      } else {
        await apiFetch("/staff/items", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast("Item created.", "success");
      }
      resetForm();
      fetchItems();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to save.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deactivate this item? It will no longer appear for students."))
      return;
    try {
      await apiFetch(`/staff/items/${id}`, { method: "DELETE" });
      toast("Item deactivated.", "success");
      fetchItems();
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to delete.", "error");
    }
  };
  const handleBulkDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkDeleteId) return;

    setIsDeletingBulk(true);
    try {
      await apiFetch(`/staff/items/${bulkDeleteId}/bookings/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({ password: bulkDeletePassword }),
      });
      toast("Bookings deleted successfully.", "success");
      setBulkDeleteId(null);
      setBulkDeletePassword("");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to bulk delete bookings.", "error");
    } finally {
      setIsDeletingBulk(false);
    }
  };
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-text-primary">Extras Items</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="glass-card p-5 rounded-xl mb-6 space-y-4 animate-fade-in"
        >
          <h2 className="text-sm font-bold text-text-primary">
            {editingId ? "Edit Item" : "New Item"}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-text-secondary mb-1">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Extra Roti"
                className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Price (₹)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="15.00"
                className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                required
              />
            </div>
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Meal</label>
                <select
                  value={formMealType}
                  onChange={(e) => setFormMealType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Closes At</label>
                <input
                  type="time"
                  value={formCloses}
                  onChange={(e) => setFormCloses(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                  required
                />
              </div>
          </div>

          {/* Recurring */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formRecurring}
                onChange={(e) => setFormRecurring(e.target.checked)}
                className="accent-accent w-4 h-4"
              />
              <span className="text-sm text-text-secondary">Recurring weekly on this date&apos;s weekday</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-2 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      {isLoading ? (
        <div className="space-y-2 animate-subtle-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-20 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-text-muted text-sm">No items yet. Create one above!</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent shadow-sm"
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent shadow-sm"
            >
              <option value="all">All Items</option>
              <option value="open">Open for Booking</option>
              <option value="closed">Closed / Past</option>
            </select>
          </div>

          <div className="space-y-2">
            {(() => {
              const now = new Date();
              const filteredItems = items.filter((item) => {
                if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                
                const opensAt = parseApiDate(item.opens_at);
                const closesAt = parseApiDate(item.closes_at);
                const isOpen = now >= opensAt && now < closesAt;
                
                if (statusFilter === "open" && !isOpen) return false;
                if (statusFilter === "closed" && isOpen) return false;
                
                return true;
              });

              if (filteredItems.length === 0) {
                return (
                  <div className="glass-card p-8 rounded-xl text-center">
                    <p className="text-text-muted text-sm">No items match your filters.</p>
                  </div>
                );
              }

              return filteredItems.map((item) => {
                const opensAt = parseApiDate(item.opens_at);
                const closesAt = parseApiDate(item.closes_at);
                const isOpen = now >= opensAt && now < closesAt;

                return (
                  <div
                    key={item.id}
                    className={`glass-card p-3.5 rounded-xl flex items-center justify-between gap-3 ${
                      !item.is_active ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-text-primary truncate">
                          {item.name}
                        </h3>
                        <span className="text-xs font-bold text-accent">
                          {formatPrice(item.price)}
                        </span>
                        {isOpen && item.is_active && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success-bg text-success">
                            OPEN
                          </span>
                        )}
                        {!item.is_active && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error-bg text-error">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">
                        {item.date} · {item.meal_type.toUpperCase()} · Book by: {formatTime(item.closes_at)}
                        {item.is_recurring ? ` · Recurring` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => openEditForm(item)}
                        className="px-2.5 py-1.5 rounded-lg border border-border text-text-secondary text-xs hover:bg-bg-surface-hover transition-colors"
                      >
                        Edit
                      </button>
                      {item.is_active && (
                        <>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-error/30 text-error text-xs hover:bg-error-bg transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setBulkDeleteId(item.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-warning/30 text-warning text-xs hover:bg-warning-bg transition-colors"
                          >
                            Clear Bookings
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
      {/* Bulk Delete Modal */}
      {bulkDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBulkDeleteId(null)} />
          <form onSubmit={handleBulkDelete} className="relative glass-card p-6 rounded-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold text-text-primary mb-2">Bulk Delete Bookings</h2>
            <p className="text-sm text-text-muted mb-4">Enter your password to confirm clearing all bookings for this item. This action cannot be undone.</p>
            <input
              type="password"
              placeholder="Your Password"
              value={bulkDeletePassword}
              onChange={(e) => setBulkDeletePassword(e.target.value)}
              required
              className="w-full px-3 py-2 mb-4 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-warning input-glow"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBulkDeleteId(null)}
                className="flex-1 py-2 rounded-xl border border-border text-text-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isDeletingBulk}
                className="flex-1 py-2 rounded-xl bg-warning hover:bg-warning/80 text-white text-sm font-bold disabled:opacity-50"
              >
                {isDeletingBulk ? "Deleting..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
