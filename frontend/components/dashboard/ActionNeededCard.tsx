import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppIcon, DomainIcons, DomainTints, IconBadge } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardKPIs } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Row = {
  key: string;
  label: string;
  sublabel: string;
  href: string;
  icon: LucideIcon;
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
      icon: DomainIcons.overdue,
      ...DomainTints.danger,
      count: kpis.overdue_returns,
      urgent: true,
    },
    {
      key: "transfers",
      label: "Pending transfers",
      sublabel: "Awaiting review",
      href: "/allocation",
      icon: DomainIcons.allocation,
      ...DomainTints.purple,
      count: kpis.pending_transfers,
    },
    {
      key: "maintenance",
      label: "Open maintenance",
      sublabel: "Pending, approved, or in progress",
      href: "/maintenance",
      icon: DomainIcons.maintenance,
      ...DomainTints.orange,
      count: kpis.maintenance_today,
    },
    {
      key: "returns",
      label: "Items checked out",
      sublabel: "Currently held outside the pool",
      href: "/allocation",
      icon: DomainIcons.assetsOut,
      ...DomainTints.pink,
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
            <IconBadge
              icon={DomainIcons.success}
              tint={DomainTints.green.tint}
              bg={DomainTints.green.bg}
              size="md"
              className="rounded-full"
            />
            <p className="text-ink-secondary text-sm font-medium">All clear</p>
            <p className="text-ink-muted text-sm">
              No transfers, returns, or maintenance need your attention right now.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {open.map((row) => (
              <li key={row.key}>
                <Link
                  href={row.href}
                  className={cn(
                    "group hover:bg-muted/70 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors",
                    row.urgent && "bg-destructive/[0.04] hover:bg-destructive/[0.08]",
                  )}
                >
                  <IconBadge icon={row.icon} tint={row.tint} bg={row.bg} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-secondary text-sm font-medium">
                      {row.label}
                      <span className="text-ink ml-1.5 tabular-nums font-semibold">
                        {row.count}
                      </span>
                    </p>
                    <p className="text-ink-faint truncate text-xs">{row.sublabel}</p>
                  </div>
                  <AppIcon
                    icon={ChevronRight}
                    className="text-ink-faint size-4 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
