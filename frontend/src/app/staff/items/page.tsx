"use client";

/**
 * Mess staff — extras items CRUD.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatTime, formatPrice, getDayName } from "@/lib/utils";
import type { ExtrasItem } from "@/types";

export default function StaffItemsPage() {
  const [items, setItems] = useState<ExtrasItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formOpens, setFormOpens] = useState("18:00");
  const [formCloses, setFormCloses] = useState("20:00");
  const [formRecurring, setFormRecurring] = useState(false);
  const [formWeekday, setFormWeekday] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    fetchItems();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormPrice("");
    setFormOpens("18:00");
    setFormCloses("20:00");
    setFormRecurring(false);
    setFormWeekday(0);
    setEditingId(null);
    setShowForm(false);
  };

  const openEditForm = (item: ExtrasItem) => {
    setFormName(item.name);
    setFormPrice(String(item.price));
    setFormOpens(item.opens_at.slice(0, 5));
    setFormCloses(item.closes_at.slice(0, 5));
    setFormRecurring(item.is_recurring);
    setFormWeekday(item.recurring_weekday || 0);
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      name: formName.trim(),
      price: parseFloat(formPrice),
      opens_at: formOpens + ":00",
      closes_at: formCloses + ":00",
      is_recurring: formRecurring,
      recurring_weekday: formRecurring ? formWeekday : null,
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
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Opens</label>
                <input
                  type="time"
                  value={formOpens}
                  onChange={(e) => setFormOpens(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Closes</label>
                <input
                  type="time"
                  value={formCloses}
                  onChange={(e) => setFormCloses(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent input-glow"
                  required
                />
              </div>
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
              <span className="text-sm text-text-secondary">Recurring weekly</span>
            </label>
            {formRecurring && (
              <select
                value={formWeekday}
                onChange={(e) => setFormWeekday(parseInt(e.target.value))}
                className="px-3 py-1.5 rounded-lg bg-bg-elevated border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {getDayName(d)}
                  </option>
                ))}
              </select>
            )}
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
        <div className="space-y-2">
          {items.map((item) => (
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
                  {!item.is_active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-error-bg text-error">
                      INACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  {formatTime(item.opens_at)} – {formatTime(item.closes_at)} ·{" "}
                  {item.prep_time_mins} min prep
                  {item.is_recurring && item.recurring_weekday != null
                    ? ` · Recurring ${getDayName(item.recurring_weekday)}`
                    : ""}
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
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="px-2.5 py-1.5 rounded-lg border border-error/30 text-error text-xs hover:bg-error-bg transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
