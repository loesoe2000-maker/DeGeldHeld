"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";
type Toast = { id: number; message: string; variant: ToastVariant };

type Ctx = {
  toast: (msg: string, variant?: ToastVariant) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) return { toast: () => {} }; // safe noop if used outside provider
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 3500);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        role="region"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.variant === "success"
                ? "bg-brand-600"
                : t.variant === "error"
                  ? "bg-red-600"
                  : "bg-slate-800"
            }`}
            role={t.variant === "error" ? "alert" : "status"}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const toastVariantClass = {
  success: "bg-brand-600",
  error: "bg-red-600",
  info: "bg-slate-800",
};
