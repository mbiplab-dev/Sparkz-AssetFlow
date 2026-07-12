"use client";

import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Structured placeholder for modules whose backend isn't built yet.
 * Shows the screen's purpose, what will appear, and a CTA to the
 * most relevant existing screen — so the tab is never a dead end.
 */
export function ModuleScreen({
  icon: Icon,
  title,
  description,
  features,
  ctaHref,
  ctaLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: { label: string; desc: string }[];
  ctaHref: string;
  ctaLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <div className="mb-2 flex items-center gap-2.5">
          <span className="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
            <Icon className="text-primary size-5" />
          </span>
          <h2 className="font-display text-ink text-2xl font-bold tracking-tight">{title}</h2>
        </div>
        <p className="text-ink-muted text-sm">{description}</p>
      </div>

      {children}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <p className="text-ink-secondary text-sm font-medium">
            What you&apos;ll find here once the module is live:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.label}
                className="border-border flex items-start gap-3 rounded-lg border p-3"
              >
                <span className="bg-accent-sky/15 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md">
                  <ArrowRight className="text-accent-sky size-3.5" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-ink text-sm font-medium">{f.label}</span>
                  <span className="text-ink-muted text-xs">{f.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <Button asChild className="mt-2 self-start rounded-full">
            <Link href={ctaHref}>
              <Icon />
              {ctaLabel}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
