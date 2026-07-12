"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Package, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listHoldings, type Holding } from "@/lib/api/allocation";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  {
    label: "My allocations",
    desc: "Return or transfer what you hold",
    href: "/allocation",
    icon: Package,
    tint: "text-accent-sky",
    bg: "bg-accent-sky/15",
  },
  {
    label: "Book a resource",
    desc: "Shared rooms, vehicles, equipment",
    href: "/booking",
    icon: CalendarClock,
    tint: "text-accent-teal",
    bg: "bg-accent-teal/15",
  },
  {
    label: "Raise maintenance",
    desc: "Report a problem with an asset",
    href: "/maintenance",
    icon: Wrench,
    tint: "text-accent-orange",
    bg: "bg-accent-orange/15",
  },
];

/**
 * Employee workspace card: real holdings first, then the actions they need
 * (view/return allocations, book, raise maintenance) — not org-wide admin work.
 */
export function MyAssetsCard() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listHoldings()
      .then((rows) => {
        if (cancelled) return;
        const mine = (Array.isArray(rows) ? rows : []).filter(
          (h) => h.quantity > 0 && h.holder_type === "employee",
        );
        setHoldings(mine);
      })
      .catch(() => {
        if (!cancelled) setHoldings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base font-semibold">Your workspace</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-ink-secondary text-sm font-medium">Allocated to you</p>
            <Link
              href="/allocation"
              className="text-primary text-xs font-medium hover:underline"
            >
              View all
            </Link>
          </div>
          {holdings === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : holdings.length === 0 ? (
            <p className="text-ink-muted rounded-md border border-dashed px-3 py-4 text-center text-sm">
              Nothing allocated yet. When a manager assigns you equipment, it shows up here and on{" "}
              <Link href="/allocation" className="text-primary font-medium hover:underline">
                Allocation
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {holdings.slice(0, 5).map((h) => (
                <li
                  key={h.id}
                  className="bg-muted/40 flex items-center justify-between gap-2 rounded-md px-2.5 py-2"
                >
                  <span className="text-ink min-w-0 truncate text-sm font-medium">
                    {h.asset_name}
                  </span>
                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                    ×{h.quantity}
                  </Badge>
                </li>
              ))}
              {holdings.length > 5 && (
                <li className="text-ink-muted px-1 text-xs">
                  +{holdings.length - 5} more on Allocation
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="border-border border-t pt-1">
          <p className="text-ink-muted mb-2 text-xs font-medium tracking-wide uppercase">
            What you can do
          </p>
          {SHORTCUTS.map(({ label, desc, href, icon: Icon, tint, bg }) => (
            <Link
              key={label}
              href={href}
              className="group hover:bg-muted/70 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", bg)}>
                <Icon className={cn("size-4", tint)} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ink-secondary text-sm font-medium">{label}</span>
                <span className="text-ink-muted truncate text-xs">{desc}</span>
              </span>
              <ArrowRight className="text-ink-faint size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
