"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "external" | "app" | "info";

export interface ToastInput {
  title: string;
  message: string;
  variant: ToastVariant;
}

interface Toast extends ToastInput {
  id: string;
}

const ToastContext = createContext<(input: ToastInput) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((input: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...input, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(100vw-1.5rem,22rem)] flex-col gap-2 sm:right-4 sm:top-4"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const styles = {
    external: {
      border: "border-sky/40",
      bg: "bg-[linear-gradient(180deg,#f8fcff_0%,#eef7ff_100%)]",
      badge: "bg-sky/20 text-[#1a5f8a]",
      icon: "☁",
    },
    app: {
      border: "border-punch/35",
      bg: "bg-[linear-gradient(180deg,#fff8f6_0%,#fff1ef_100%)]",
      badge: "bg-punch/15 text-[#8f2f24]",
      icon: "⚙",
    },
    info: {
      border: "border-black/10",
      bg: "bg-paper",
      badge: "bg-black/5 text-ink-soft",
      icon: "ℹ",
    },
  }[toast.variant];

  return (
    <div
      role="status"
      className={`pointer-events-auto rounded-xl border p-3 shadow-[0_12px_32px_rgba(23,18,15,0.12)] backdrop-blur-sm ${styles.border} ${styles.bg}`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm"
          aria-hidden
        >
          {styles.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold text-foreground">{toast.title}</p>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${styles.badge}`}
            >
              {toast.variant === "external" ? "External service" : toast.variant === "app" ? "App issue" : "Notice"}
            </span>
          </div>
          <p className="text-[11px] leading-4 text-ink-soft">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-sm leading-none text-ink-soft transition hover:bg-black/5 hover:text-foreground"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
