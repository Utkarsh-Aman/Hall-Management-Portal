"use client";

/**
 * QR Scanner page for mess_worker — full-screen, phone-friendly.
 * Uses html5-qrcode for camera-based scanning.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { ScanResult, ScanSuccess, ScanAlreadyUsed } from "@/types";

// Note: Replace these placeholders with actual base64 audio strings for better sound
const SUCCESS_BEEP = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";
const ERROR_BEEP = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";

const playSound = (src: string) => {
  try {
    const audio = new Audio(src);
    audio.play().catch((e) => console.log("Audio play blocked by browser:", e));
  } catch (e) {
    console.error("Failed to play audio", e);
  }
};

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);
  const { toast } = useToast();

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (html5QrCodeRef.current as any).stop();
      } catch {
        // Ignore stop errors
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const handleScan = useCallback(
    async (decodedText: string) => {
      // Prevent multiple scans while processing
      if (isProcessing) return;
      setIsProcessing(true);

      await stopScanner();

      try {
        const result = await apiFetch<ScanResult>("/worker/scan", {
          method: "POST",
          body: JSON.stringify({ qr_token: decodedText }),
        });

        setScanResult(result);

        if ("already_served" in result && result.already_served) {
          playSound(ERROR_BEEP);
          toast("This QR code was already used.", "warning");
        } else {
          playSound(SUCCESS_BEEP);
          toast("Marked as served!", "success");
        }
      } catch (err: unknown) {
        playSound(ERROR_BEEP);
        const error = err as Error & { status?: number };
        if (error.status === 404) {
          toast("QR code not recognized.", "error");
        } else {
          toast(error.message || "Scan failed.", "error");
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, stopScanner, toast]
  );

  const startScanner = useCallback(async () => {
    setScanResult(null);
    setCameraError(null);

    try {
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import("html5-qrcode");

      const scanner = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          handleScan(decodedText);
        },
        () => {
          // QR scan error — ignore (happens every frame without a QR code)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError(
        "Camera access denied or not available. Use the manual queue instead."
      );
    }
  }, [handleScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const isAlreadyUsed = scanResult && "already_served" in scanResult;
  const isSuccess = scanResult && !isAlreadyUsed;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 py-6">
      {/* Scanner area */}
      {!scanResult && (
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Camera viewport */}
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full aspect-square rounded-2xl overflow-hidden bg-bg-surface border-2 border-border"
          />

          {cameraError && (
            <div className="w-full p-4 rounded-xl bg-error-bg border border-error/20 text-sm text-error text-center">
              {cameraError}
            </div>
          )}

          {/* Start/Stop button */}
          {!isScanning ? (
            <button
              onClick={startScanner}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-accent hover:bg-accent-hover text-white text-lg font-bold transition-colors min-h-[56px]"
            >
              {isProcessing ? "Processing…" : "📷 Start Scanner"}
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="w-full py-4 rounded-2xl border-2 border-border text-text-secondary text-lg font-bold transition-colors min-h-[56px] hover:bg-bg-surface-hover"
            >
              Stop Scanner
            </button>
          )}
        </div>
      )}

      {/* Scan result — success */}
      {isSuccess && (
        <div className="w-full max-w-sm animate-fade-in">
          <div className="glass-card p-6 rounded-2xl border-success/30 bg-success-bg text-center space-y-4">
            <div className="text-5xl">✓</div>
            <h2 className="text-lg font-bold text-success">Marked as Served</h2>
            <div className="space-y-2 text-sm">
              <p className="text-text-secondary">
                <strong className="text-text-primary">
                  {(scanResult as ScanSuccess).item_name}
                </strong>
              </p>
              <p className="text-text-muted">
                Qty: {(scanResult as ScanSuccess).qty} ·{" "}
                Student: {(scanResult as ScanSuccess).student_identifier}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setScanResult(null);
              startScanner();
            }}
            className="w-full mt-4 py-4 rounded-2xl bg-accent hover:bg-accent-hover text-white text-lg font-bold transition-colors min-h-[56px]"
          >
            Scan Next
          </button>
        </div>
      )}

      {/* Scan result — already used */}
      {isAlreadyUsed && (
        <div className="w-full max-w-sm animate-fade-in">
          <div className="glass-card p-6 rounded-2xl border-warning/30 bg-warning-bg text-center space-y-4">
            <div className="text-5xl">⚠</div>
            <h2 className="text-lg font-bold text-warning">Already Used</h2>
            <p className="text-sm text-text-muted">
              This QR code was served at{" "}
              {new Date(
                (scanResult as ScanAlreadyUsed).served_at
              ).toLocaleTimeString("en-IN")}
            </p>
          </div>
          <button
            onClick={() => {
              setScanResult(null);
              startScanner();
            }}
            className="w-full mt-4 py-4 rounded-2xl bg-accent hover:bg-accent-hover text-white text-lg font-bold transition-colors min-h-[56px]"
          >
            Scan Next
          </button>
        </div>
      )}

      {/* Link to manual queue */}
      <Link
        href="/worker/queue"
        className="mt-6 text-sm text-text-muted hover:text-accent transition-colors"
      >
        View today&apos;s queue manually →
      </Link>
    </div>
  );
}
