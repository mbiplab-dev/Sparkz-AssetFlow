import Link from "next/link";
import { ArrowLeftRight, CheckCircle2, ChevronRight, Clock, Undo2, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardKPIs } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type Row = {
  key: string;
  label: string;
  sublabel: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tint: string;
  bg: string;
  count: number;
  urgent?: boolean;
};

export function ActionNeededCard({ kpis }: { kpis: DashboardKPIs }) {
  const rows: Row[] = [
    {
      key: "overdue",
      label: "Overdue returns",
      sublabel: "Past expected return date",
      href: "/allocation",
      icon: Clock,
      tint: "text-destructive",
      bg: "bg-destructive/10",
      count: kpis.overdue_returns,
      urgent: true,
    },
    {
      key: "transfers",
      label: "Pending transfers",
      sublabel: "Awaiting review",
      href: "/allocation",
      icon: ArrowLeftRight,
      tint: "text-accent-purple-deep",
      bg: "bg-accent-purple/25",
      count: kpis.pending_transfers,
    },
    {
      key: "maintenance",
      label: "Maintenance in progress",
      sublabel: "Approved or being worked on today",
      href: "/maintenance",
      icon: Wrench,
      tint: "text-accent-orange",
      bg: "bg-accent-orange/15",
      count: kpis.maintenance_today,
    },
    {
      key: "returns",
      label: "Upcoming returns",
      sublabel: "Due back soon",
      href: "/allocation",
      icon: Undo2,
      tint: "text-accent-pink",
      bg: "bg-accent-pink/15",
      count: kpis.upcoming_returns,
    },
  ];

  const open = rows.filter((r) => r.count > 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-display text-base font-semibold">Action needed</CardTitle>
      </CardHeader>
      <CardContent>
        {open.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <span className="bg-accent-green/15 flex size-9 items-center justify-center rounded-full">
              <CheckCircle2 className="text-accent-green size-5" />
            </span>
            <p className="text-ink-secondary text-sm font-medium">All clear</p>
            <p className="text-ink-muted text-sm">
              No transfers, returns, or maintenance need your attention right now.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col">
            {open.map((row) => (
              <li key={row.key}>
                <Link
                  href={row.href}
                  className="group hover:bg-muted/70 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md",
                      row.bg,
                    )}
                  >
                    <row.icon className={cn("size-4", row.tint)} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-ink-secondary truncate text-sm font-medium">
                      {row.label}
                    </span>
                    <span className="text-ink-muted truncate text-xs">{row.sublabel}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      row.urgent
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-ink-secondary",
                    )}
                  >
                    {row.count}
                  </span>
                  <ChevronRight className="text-ink-faint size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
