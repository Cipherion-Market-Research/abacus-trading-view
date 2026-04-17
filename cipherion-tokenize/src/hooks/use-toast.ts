"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  description?: string;
  action?: { label: string; href: string };
}

let globalSetToasts: React.Dispatch<React.SetStateAction<Toast[]>> | null =
  null;
let toastCounter = 0;

function addToastGlobal(toast: Omit<Toast, "id">) {
  const id = `toast-${++toastCounter}`;
  const newToast = { ...toast, id };

  if (globalSetToasts) {
    globalSetToasts((prev) => {
      const next = [...prev, newToast];
      return next.slice(-3); // max 3 visible
    });
    setTimeout(() => {
      globalSetToasts?.((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }
}

export function useToastStore() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  globalSetToasts = setToasts;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, dismiss };
}

export function toast(
  variant: ToastVariant,
  message: string,
  options?: { description?: string; action?: { label: string; href: string } }
) {
  addToastGlobal({ variant, message, ...options });
}

export const toastSuccess = (
  message: string,
  options?: { description?: string; action?: { label: string; href: string } }
) => toast("success", message, options);

export const toastError = (
  message: string,
  options?: { description?: string }
) => toast("error", message, options);

export const toastWarning = (
  message: string,
  options?: { description?: string }
) => toast("warning", message, options);

export const toastInfo = (
  message: string,
  options?: { description?: string }
) => toast("info", message, options);
