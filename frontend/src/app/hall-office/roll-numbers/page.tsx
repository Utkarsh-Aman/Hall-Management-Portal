"use client";

/**
 * Roll numbers CSV upload — replace mode.
 */

import React, { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { RollNumberUploadResponse } from "@/types";

export default function RollNumbersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<RollNumberUploadResponse | null>(
    null
  );
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast("Please select a .csv file.", "warning");
      return;
    }

    if (file.size > 1_048_576) {
      toast("File too large. Maximum size is 1MB.", "warning");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await apiFetch<RollNumberUploadResponse>(
        "/hall-office/roll-numbers/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      setLastResult(data);
      toast(data.message, "success");
      setFile(null);

      // Reset file input
      const input = document.getElementById(
        "csv-input"
      ) as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (err: unknown) {
      const error = err as Error;
      toast(error.message || "Upload failed.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-bold text-text-primary mb-2">
        Roll Number Upload
      </h1>
      <p className="text-sm text-text-muted mb-6">
        Upload a CSV file containing student roll numbers. This will{" "}
        <span className="text-warning font-medium">replace</span> the entire
        existing list.
      </p>

      <div className="glass-card p-6 rounded-xl space-y-5">
        {/* File input */}
        <div>
          <label
            htmlFor="csv-input"
            className="block text-xs font-medium text-text-secondary mb-2"
          >
            CSV File (one roll number per row)
          </label>
          <input
            id="csv-input"
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent file:text-white file:cursor-pointer hover:file:bg-accent-hover"
          />
        </div>

        {/* Preview */}
        {file && (
          <div className="bg-bg-elevated p-3 rounded-lg">
            <p className="text-sm text-text-secondary">
              📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
            <p className="text-xs text-warning mt-1">
              ⚠ This will replace all existing roll numbers.
            </p>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? "Uploading…" : "Upload & Replace"}
        </button>
      </div>

      {/* Last upload result */}
      {lastResult && (
        <div className="glass-card p-4 rounded-xl mt-4 border-success/20 bg-success-bg animate-fade-in">
          <p className="text-sm text-success font-medium">
            ✓ {lastResult.message}
          </p>
        </div>
      )}
    </div>
  );
}
