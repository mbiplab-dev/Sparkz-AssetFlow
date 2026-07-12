"use client";

import { BarChart3 } from "lucide-react";
import { ModuleScreen } from "@/components/ModuleScreen";

export default function ReportsPage() {
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
