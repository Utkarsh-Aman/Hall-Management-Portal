"use client";

/**
 * Mess staff — weekly menu editor (7×3 grid).
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { getDayName, getTodayWeekday } from "@/lib/utils";
import type { MenuSlot, WeeklyMenuResponse } from "@/types";

const MEALS = ["breakfast", "lunch", "dinner"] as const;

export default function StaffMenuPage() {
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const data = await apiFetch<WeeklyMenuResponse>("/staff/menu");
        const map: Record<string, string> = {};
        data.slots.forEach((s) => {
          map[`${s.day_of_week}-${s.meal_type}`] = s.description;
        });
        setSlots(map);
      } catch (err: unknown) {
        const error = err as Error;
        toast(error.message || "Failed to load menu.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, [toast]);

  const handleSave = async (day: number, meal: string) => {
    const key = `${day}-${meal}`;
    const description = slots[key] || "";

    setSavingKey(key);
    try {
      await apiFetch(`/staff/menu/${day}/${meal}`, {
        method: "PUT",
        body: JSON.stringify({ description }),
      });
      toast(`${getDayName(day)} ${meal} updated.`, "success");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Failed to save.", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const todayWeekday = getTodayWeekday();

  if (isLoading) {
    return (
      <div className="space-y-3 animate-subtle-pulse">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="glass-card h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg font-bold text-text-primary mb-4">
        Weekly Menu Editor
      </h1>

      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
          const isToday = day === todayWeekday;
          return (
            <div
              key={day}
              className={`glass-card rounded-xl p-4 ${
                isToday ? "border-accent/40 bg-accent-bg" : ""
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-sm font-bold ${
                    isToday ? "text-accent" : "text-text-primary"
                  }`}
                >
                  {getDayName(day)}
                </span>
                {isToday && (
                  <span className="text-[10px] font-bold bg-accent text-white px-1.5 py-0.5 rounded-full">
                    TODAY
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MEALS.map((meal) => {
                  const key = `${day}-${meal}`;
                  const isSaving = savingKey === key;
                  return (
                    <div key={meal}>
                      <label className="block text-[10px] uppercase text-text-muted font-semibold tracking-wider mb-1">
                        {meal}
                      </label>
                      <textarea
                        value={slots[key] || ""}
                        onChange={(e) =>
                          setSlots((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        onBlur={() => handleSave(day, meal)}
                        placeholder="Enter menu…"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent input-glow transition-colors resize-none"
                      />
                      {isSaving && (
                        <p className="text-[10px] text-accent mt-0.5">
                          Saving…
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
