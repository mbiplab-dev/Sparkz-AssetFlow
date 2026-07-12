"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/http";
import {
  getDashboardReports,
  type CategoryCount,
  type DashboardReports,
  type DepartmentCount,
} from "@/lib/api/dashboard";

/** Humanize a snake_case status enum for display. */
function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Horizontal bar strip — label on the left, filled bar + count on the right. */
function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink w-32 truncate text-sm" title={label}>
        {label}
      </span>
      <div className="bg-muted relative h-2.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-primary/70 absolute inset-y-0 left-0 rounded-full transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-ink-muted w-8 text-right text-xs tabular-nums">{value}</span>
    </div>
  );
}

function StatusBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-ink-muted text-sm">No data yet.</p>;
  }
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="flex flex-col gap-2">
      {entries.map(([k, v]) => (
        <BarRow key={k} label={humanize(k)} value={v} max={max} />
      ))}
    </div>
  );
}

function CategoryBars({ data }: { data: CategoryCount[] }) {
  if (data.length === 0) {
    return <p className="text-ink-muted text-sm">No data yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <BarRow key={d.category} label={d.category} value={d.count} max={max} />
      ))}
    </div>
  );
}

function DepartmentBars({ data }: { data: DepartmentCount[] }) {
  if (data.length === 0) {
    return <p className="text-ink-muted text-sm">No data yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <BarRow key={d.department} label={d.department} value={d.count} max={max} />
      ))}
    </div>
  );
}

function TopUsedList({ data }: { data: DashboardReports["top_used_assets"] }) {
  if (data.length === 0) {
    return <p className="text-ink-muted text-sm">No maintenance activity yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ol className="flex flex-col gap-2">
      {data.map((a, i) => (
        <li key={a.asset_id} className="flex items-center gap-3">
          <span className="text-ink-muted w-5 shrink-0 text-xs tabular-nums">{i + 1}.</span>
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-sm font-medium">{a.name}</p>
            <p className="text-ink-faint text-xs">{a.asset_tag}</p>
          </div>
          <div className="bg-muted relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
            <div
              className="bg-primary/70 absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.max(4, Math.round((a.count / max) * 100))}%` }}
            />
          </div>
          <span className="text-ink-muted w-6 text-right text-xs tabular-nums">{a.count}</span>
        </li>
      ))}
    </ol>
  );
}

function HourHeatmap({ data }: { data: DashboardReports["booking_load_by_hour"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-32 items-end gap-[3px]">
      {data.map((d) => {
        const pct = Math.max(4, Math.round((d.count / max) * 100));
        return (
          <div
            key={d.hour}
            className="group relative flex flex-1 flex-col items-center gap-1"
            title={`${d.hour}:00 — ${d.count} bookings`}
          >
            <div
              className="bg-primary/70 w-full rounded-t-sm transition-all group-hover:bg-primary"
              style={{ height: `${pct}%` }}
            />
            {d.hour % 3 === 0 && (
              <span className="text-ink-faint text-[10px] tabular-nums">{d.hour}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-ink text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-3/4" />
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const canViewReports = useCan("reports.view");
  const [reports, setReports] = useState<DashboardReports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canViewReports) return;
    let cancelled = false;
    // 500ms deliberate delay so the skeleton is visible on fast networks.
    const started = Date.now();
    getDashboardReports()
      .then((data) => {
        if (cancelled) return;
        const elapsed = Date.now() - started;
        const wait = Math.max(0, 500 - elapsed);
        setTimeout(() => {
          if (cancelled) return;
          setReports(data);
          setLoading(false);
        }, wait);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : "Could not load reports.";
        toast.error("Couldn't load reports", { description: msg });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewReports]);

  if (!canViewReports) {
    return (
      <div className="mx-auto w-full max-w-md py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="bg-muted flex size-11 items-center justify-center rounded-xl">
              <BarChart3 className="text-ink-faint size-5" />
            </span>
            <h2 className="font-display text-ink text-lg font-semibold">
              You don&apos;t have access to Reports.
            </h2>
            <p className="text-ink-muted text-sm">
              Reports are available to admins, asset managers, and department heads.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-ink text-2xl font-semibold">Reports &amp; Analytics</h1>
        <p className="text-ink-muted text-sm">
          Live operational insight — utilization by status, maintenance frequency, department
          distribution, and booking peaks.
          {reports && reports.overdue_returns_count > 0 && (
            <span className="text-ink ml-1 font-medium">
              {reports.overdue_returns_count} overdue return
              {reports.overdue_returns_count === 1 ? "" : "s"}.
            </span>
          )}
        </p>
      </header>

      {loading || !reports ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ReportCard title="Assets by status">
            <StatusBars data={reports.assets_by_status} />
          </ReportCard>
          <ReportCard title="Assets by category">
            <CategoryBars data={reports.assets_by_category} />
          </ReportCard>
          <ReportCard title="Assets by department">
            <DepartmentBars data={reports.assets_by_department} />
          </ReportCard>
          <ReportCard title="Maintenance by status">
            <StatusBars data={reports.maintenance_by_status} />
          </ReportCard>
          <ReportCard title="Maintenance by category">
            <CategoryBars data={reports.maintenance_by_category} />
          </ReportCard>
          <ReportCard title="Top used assets">
            <TopUsedList data={reports.top_used_assets} />
          </ReportCard>
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-ink text-sm font-semibold">
                Booking load by hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HourHeatmap data={reports.booking_load_by_hour} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
