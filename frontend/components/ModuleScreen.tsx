"use client";

import type { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Minimal shell for modules that aren't backed by APIs yet.
 * Renders the title + description, and a compact "not built yet" card.
 * Extra props like `features`, `ctaHref`, `ctaLabel` are accepted for
 * backward-compat with existing callers but ignored.
 */
export function ModuleScreen({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features?: { label: string; desc: string }[];
  ctaHref?: string;
  ctaLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-6">
      <div className="min-w-0">
        <div className="mb-2 flex items-start gap-2.5 sm:items-center">
          <span className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-primary size-5" />
          </span>
          <h2 className="font-display text-ink text-xl font-bold tracking-tight break-words sm:text-2xl">
            {title}
          </h2>
        </div>
        <p className="text-ink-muted text-sm">{description}</p>
      </div>

      {children}

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:py-10">
          <span className="bg-muted flex size-10 items-center justify-center rounded-full">
            <Icon className="text-ink-muted size-5" />
          </span>
          <p className="text-ink text-sm font-medium">Not available yet</p>
          <p className="text-ink-muted max-w-sm text-xs">
            This module hasn&apos;t been enabled for your workspace. Check back soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
