"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ModuleScreen } from "@/components/ModuleScreen";
import { useCan } from "@/lib/auth/permissions";

export default function ReportsPage() {
  const canViewReports = useCan("reports.view");

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
    <ModuleScreen
      icon={BarChart3}
      title="Reports & Analytics"
      description="Actionable operational insight — utilization trends, maintenance frequency, department summaries, and booking heatmaps."
      features={[
        { label: "Asset utilization", desc: "Most-used vs idle assets over time" },
        { label: "Maintenance frequency", desc: "By asset and category, with cost breakdowns" },
        { label: "Department allocation", desc: "Active allocations summarized per department" },
        { label: "Booking heatmap", desc: "Peak usage windows for shared resources" },
        { label: "Exportable reports", desc: "Download CSV/PDF for sharing and archiving" },
      ]}
      ctaHref="/assets"
      ctaLabel="View asset directory"
    />
  );
}
