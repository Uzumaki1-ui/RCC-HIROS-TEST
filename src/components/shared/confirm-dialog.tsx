"use client";

import { AlertTriangle, Info } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="bg-rcc-surface rounded-lg shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDanger ? "bg-red-50" : "bg-amber-50"
            }`}
          >
            {isDanger ? (
              <AlertTriangle className="h-5 w-5 text-rcc-error" />
            ) : (
              <Info className="h-5 w-5 text-rcc-warning" />
            )}
          </div>
          <div>
            <h3
              id="confirm-dialog-title"
              className="text-base font-semibold text-rcc-text-primary"
            >
              {title}
            </h3>
            <p className="text-sm text-rcc-text-muted mt-1">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm font-medium border border-rcc-border text-rcc-text-secondary hover:bg-rcc-bg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              isDanger
                ? "bg-rcc-error text-white hover:bg-red-700"
                : "bg-rcc-warning text-white hover:bg-amber-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
