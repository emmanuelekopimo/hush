"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function Submit({ children, pendingText, className = "btn btn-primary" }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Working...") : children}
    </button>
  );
}
