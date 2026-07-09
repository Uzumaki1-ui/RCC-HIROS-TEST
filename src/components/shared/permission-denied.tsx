"use client";
import { ShieldX } from "lucide-react";

export function PermissionDenied({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <ShieldX className="h-8 w-8 text-rcc-error" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-rcc-text-primary mb-2">Access Denied</h2>
        <p className="text-sm text-rcc-text-muted">{message || "Your role does not have permission to access this page."}</p>
      </div>
    </div>
  );
}
