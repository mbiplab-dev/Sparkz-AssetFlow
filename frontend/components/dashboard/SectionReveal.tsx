import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Thin wrapper that gives each dashboard section a consistent, barely-there
 * entrance: fade + 12px slide-up, ease-out, with an optional stagger delay so
 * the page assembles top-to-bottom instead of flashing in all at once.
 */
export function SectionReveal({
  children,
  className,
  delay = 0,
  duration = 500,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-out", className)}
      style={{ animationDuration: `${duration}ms`, animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
