"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGate, Can } from "@/components/rbac/RoleGate";
import { AreaChart, DonutChart, VerticalBarChart, humanize } from "@/components/reports/charts";
import {
  downloadClientCsv,
  downloadCsvWithToast,
  printReportAsPdf,
  type ExportResource,
} from "@/lib/api/exports";
import { ApiError } from "@/lib/api/http";
import {
  getDashboardReports,
  type DashboardReports,
} from "@/lib/api/dashboard";

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
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
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  );
}

const DATASET_EXPORTS: { resource: ExportResource; label: string }[] = [
  { resource: "assets", label: "Assets" },
  { resource: "holdings", label: "Holdings" },
  { resource: "bookings", label: "Bookings" },
  { resource: "maintenance", label: "Maintenance" },
  { resource: "departments", label: "Departments" },
  { resource: "categories", label: "Categories" },
  { resource: "employees", label: "Employees" },
];

function exportReportsCsv(reports: DashboardReports) {
  const rows: (string | number)[][] = [];
  for (const [status, count] of Object.entries(reports.assets_by_status)) {
    rows.push(["assets_by_status", status, count]);
  }
  for (const row of reports.assets_by_category) {
    rows.push(["assets_by_category", row.category, row.count]);
  }
  for (const row of reports.assets_by_department) {
    rows.push(["assets_by_department", row.department, row.count]);
  }
  for (const [status, count] of Object.entries(reports.maintenance_by_status)) {
    rows.push(["maintenance_by_status", status, count]);
  }
  for (const row of reports.maintenance_by_category) {
    rows.push(["maintenance_by_category", row.category, row.count]);
  }
  for (const a of reports.top_used_assets) {
    rows.push(["top_used_assets", `${a.asset_tag} ${a.name}`, a.count]);
  }
  for (const h of reports.booking_load_by_hour) {
    rows.push(["booking_load_by_hour", `${h.hour}:00`, h.count]);
  }
  rows.push(["overdue_returns_count", "total", reports.overdue_returns_count]);

  downloadClientCsv(
    `assetflow-reports-${new Date().toISOString().slice(0, 10)}.csv`,
    ["series", "label", "value"],
    rows,
  );
  toast.success("Reports CSV downloaded");
}

function exportReportsPdf(reports: DashboardReports) {
  const section = (title: string, pairs: [string, number][]) => {
    if (pairs.length === 0) return `<h2>${title}</h2><p>No data</p>`;
    const rows = pairs
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join("");
    return `<h2>${title}</h2><table><thead><tr><th>Label</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>`;
  };

  const html = [
    section(
      "Assets by status",
      Object.entries(reports.assets_by_status).map(([k, v]) => [humanize(k), v]),
    ),
    section(
      "Assets by category",
      reports.assets_by_category.map((r) => [r.category, r.count]),
    ),
    section(
      "Assets by department",
      reports.assets_by_department.map((r) => [r.department, r.count]),
    ),
    section(
      "Maintenance by status",
      Object.entries(reports.maintenance_by_status).map(([k, v]) => [humanize(k), v]),
    ),
    section(
      "Maintenance by category",
      reports.maintenance_by_category.map((r) => [r.category, r.count]),
    ),
    section(
      "Top used assets",
      reports.top_used_assets.map((a) => [`${a.asset_tag} — ${a.name}`, a.count]),
    ),
    section(
      "Booking load by hour",
      reports.booking_load_by_hour
        .filter((h) => h.count > 0)
        .map((h) => [`${h.hour}:00`, h.count]),
    ),
    `<h2>Overdue / stale requests</h2><p>${reports.overdue_returns_count}</p>`,
  ].join("");

  printReportAsPdf("AssetFlow Reports & Analytics", html);
}

export default function ReportsPage() {
  const [reports, setReports] = useState<DashboardReports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDashboardReports()
      .then((data) => {
        if (!cancelled) {
          setReports(data);
          setLoading(false);
        }
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
  }, []);

  return (
    <RoleGate
      capability="reports.view"
      title="You don't have access to Reports"
      description="Reports are available to admins, asset managers, and department heads."
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-ink text-xl font-semibold sm:text-2xl">
              Reports &amp; Analytics
            </h1>
            <p className="text-ink-muted text-sm">
              Live operational insight — status mix, utilization, and booking peaks.
              {reports && reports.overdue_returns_count > 0 && (
                <span className="text-ink ml-1 font-medium">
                  {reports.overdue_returns_count} open request
                  {reports.overdue_returns_count === 1 ? "" : "s"} older than 7 days.
                </span>
              )}
            </p>
          </div>

          <Can capability="exports.download">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!reports}
                onClick={() => reports && exportReportsCsv(reports)}
              >
                <FileText className="size-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={!reports}
                onClick={() => reports && exportReportsPdf(reports)}
              >
                <Printer className="size-4" />
                Export PDF
              </Button>
            </div>
          </Can>
        </header>

        {loading || !reports ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <ReportCard title="Assets by status">
              <DonutChart data={reports.assets_by_status} />
            </ReportCard>
            <ReportCard title="Maintenance by status">
              <DonutChart data={reports.maintenance_by_status} />
            </ReportCard>
            <ReportCard title="Assets by category">
              <VerticalBarChart
                data={reports.assets_by_category.map((d) => ({
                  label: d.category,
                  value: d.count,
                }))}
              />
            </ReportCard>
            <ReportCard title="Assets by department">
              <VerticalBarChart
                data={reports.assets_by_department.map((d) => ({
                  label: d.department,
                  value: d.count,
                }))}
              />
            </ReportCard>
            <ReportCard title="Maintenance by category">
              <VerticalBarChart
                data={reports.maintenance_by_category.map((d) => ({
                  label: d.category,
                  value: d.count,
                }))}
              />
            </ReportCard>
            <ReportCard title="Top used assets (by maintenance)">
              <VerticalBarChart
                data={reports.top_used_assets.map((a) => ({
                  label: a.asset_tag,
                  value: a.count,
                }))}
              />
            </ReportCard>
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-ink text-sm font-semibold">
                  Booking load by hour
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart data={reports.booking_load_by_hour} />
              </CardContent>
            </Card>
          </div>
        )}

        <Can capability="exports.download">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-ink text-sm font-semibold">
                Dataset exports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-ink-muted mb-3 text-sm">
                Download raw operational CSVs. Access is limited to managers and department heads.
              </p>
              <div className="flex flex-wrap gap-2">
                {DATASET_EXPORTS.map(({ resource, label }) => (
                  <Button
                    key={resource}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-full"
                    onClick={() => downloadCsvWithToast(resource)}
                  >
                    <Download className="size-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </Can>
      </div>
    </RoleGate>
  );
}
