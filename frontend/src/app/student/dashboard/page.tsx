"use client";

/**
 * Student Dashboard — wastage summary cards + weekly menu.
 * This is the landing page for students after login.
 */

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, getDayName, getTodayWeekday } from "@/lib/utils";
import type { DashboardSummary, MenuSlot, WeeklyMenuResponse } from "@/types";

export default function StudentDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [menuSlots, setMenuSlots] = useState<MenuSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, menuData] = await Promise.all([
          apiFetch<DashboardSummary>("/dashboard/summary"),
          apiFetch<WeeklyMenuResponse>("/menu/weekly"),
        ]);
        setSummary(summaryData);
        setMenuSlots(menuData.slots);
      } catch (err: unknown) {
        const error = err as Error;
        toast(error.message || "Failed to load dashboard.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const todayWeekday = getTodayWeekday();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-subtle-pulse">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-24 rounded-xl" />
          ))}
        </div>
        <div className="glass-card h-64 rounded-xl" />
      </div>
    );
  }

  // Build menu grid: organize slots by day
  const menuByDay: Record<number, Record<string, string>> = {};
  for (let d = 0; d < 7; d++) {
    menuByDay[d] = { breakfast: "", lunch: "", dinner: "" };
  }
  menuSlots.forEach((slot) => {
    menuByDay[slot.day_of_week][slot.meal_type] = slot.description;
  });

  return (
    <div className="space-y-6">
      {/* Wastage Summary Strip */}
      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          Mess Wastage
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Avg BDMR */}
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs text-text-muted mb-1">Avg. BDMR (7-day)</p>
            <p className="text-2xl font-bold text-accent">
              {summary?.avg_bdmr != null
                ? summary.avg_bdmr.toFixed(2)
                : "—"}
            </p>
          </div>

          {/* Plain Wastage */}
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs text-text-muted mb-1">Plain Wastage</p>
            <p className="text-2xl font-bold text-text-primary">
              {summary?.plain_wastage != null
                ? summary.plain_wastage.toFixed(2)
                : "—"}
            </p>
          </div>

          {/* Plate Wastage */}
          <div className="glass-card p-4 rounded-xl">
            <p className="text-xs text-text-muted mb-1">Plate Wastage</p>
            <p className="text-2xl font-bold text-text-primary">
              {summary?.plate_wastage != null
                ? summary.plate_wastage.toFixed(2)
                : "—"}
            </p>
          </div>
        </div>

        {summary?.last_updated && (
          <p className="text-[11px] text-text-muted mt-2">
            Last updated: {formatDateTime(summary.last_updated)}
          </p>
        )}
      </section>

      {/* Weekly Menu */}
      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          This Week&apos;s Menu
        </h2>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => {
            const isToday = day === todayWeekday;
            return (
              <div
                key={day}
                className={`glass-card rounded-xl overflow-hidden transition-colors ${
                  isToday
                    ? "border-accent/40 bg-accent-bg"
                    : ""
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-sm font-semibold ${
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
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-text-muted block mb-0.5">
                        Breakfast
                      </span>
                      <span className="text-text-secondary">
                        {menuByDay[day].breakfast || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-0.5">
                        Lunch
                      </span>
                      <span className="text-text-secondary">
                        {menuByDay[day].lunch || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-0.5">
                        Dinner
                      </span>
                      <span className="text-text-secondary">
                        {menuByDay[day].dinner || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
