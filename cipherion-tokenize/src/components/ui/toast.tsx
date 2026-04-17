"use client";

import { X, CheckCircle, AlertCircle, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/hooks/use-toast";

const variantStyles: Record<
  ToastVariant,
  { bg: string; border: string; icon: React.ReactNode }
> = {
  success: {
    bg: "bg-[rgba(63,185,80,0.1)]",
    border: "border-[#238636]",
    icon: <CheckCircle className="size-4 text-[#3fb950]" />,
  },
  error: {
    bg: "bg-[rgba(248,81,73,0.1)]",
    border: "border-[#f85149]",
    icon: <AlertCircle className="size-4 text-[#f85149]" />,
  },
  warning: {
    bg: "bg-[rgba(210,153,34,0.1)]",
    border: "border-[#d29922]",
    icon: <AlertTriangle className="size-4 text-[#d29922]" />,
  },
  info: {
    bg: "bg-[rgba(88,166,255,0.1)]",
    border: "border-[#58a6ff]",
    icon: <Info className="size-4 text-[#58a6ff]" />,
  },
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[380px]">
      {toasts.map((t) => {
        const style = variantStyles[t.variant];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg border ${style.border} ${style.bg} p-3 shadow-lg animate-in slide-in-from-right-5 fade-in-0 duration-200`}
          >
            <div className="mt-0.5 shrink-0">{style.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#f0f6fc]">{t.message}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-[#8b949e]">
                  {t.description}
                </p>
              )}
              {t.action && (
                <a
                  href={t.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-[#58a6ff] hover:underline"
                >
                  {t.action.label}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
