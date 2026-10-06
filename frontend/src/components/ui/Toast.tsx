"use client";

/**
 * Toast notification system - provides feedback on user actions.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const typeStyles: Record<ToastType, string> = {
    success:
      "bg-success-bg border-success/30 text-success",
    error:
      "bg-error-bg border-error/30 text-error",
    warning:
      "bg-warning-bg border-warning/30 text-warning",
    info: "bg-accent-bg border-accent/30 text-accent",
  };

  const icons: Record<ToastType, string> = {
    success: "",
    error: "",
    warning: "Warning:",
    info: "Info",
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container - fixed top-right */}
      <div className="fixed top-3 inset-x-3 z-[100] flex flex-col gap-2 pointer-events-none sm:top-4 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-enter pointer-events-auto flex items-start gap-2 px-3 py-2.5 rounded-lg border backdrop-blur-sm shadow-lg cursor-pointer sm:gap-3 sm:px-4 sm:py-3 sm:rounded-xl ${typeStyles[t.type]}`}
            onClick={() => removeToast(t.id)}
            role="alert"
          >
            {icons[t.type] && (
              <span className="text-sm flex-shrink-0 sm:text-lg sm:mt-0.5">{icons[t.type]}</span>
            )}
            <p className="text-xs font-medium leading-snug break-words sm:text-sm">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
