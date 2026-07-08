"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { apiFetchBlob } from "@/lib/api";

export default function StaffReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!startDate || !endDate) {
      toast("Please select both start and end dates.", "warning");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast("Start date cannot be after end date.", "warning");
      return;
    }

    setIsDownloading(true);
    try {
      const blob = await apiFetchBlob(`/staff/reports/extras/export?start_date=${startDate}&end_date=${endDate}`);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      // Add download timestamp to filename
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      link.download = `extras_report_${startDate}_to_${endDate}_${ts}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast("Download started successfully", "success");
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Download failed", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary mb-2">Reports</h1>
        <p className="text-sm text-text-muted">
          Download CSV reports of extra item consumption by students.
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl space-y-5">
        <h2 className="text-sm font-semibold text-text-primary">Extras Consumption Report</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              required
            />
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={!startDate || !endDate || isDownloading}
          className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? "Generating CSV..." : "Download CSV"}
        </button>
      </div>
    </div>
  );
}
