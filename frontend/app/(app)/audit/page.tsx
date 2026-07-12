"use client";

import { ClipboardCheck } from "lucide-react";
import { ModuleScreen } from "@/components/ModuleScreen";

export default function AuditPage() {
  return (
    <ModuleScreen
      icon={ClipboardCheck}
      title="Asset Audit"
      description="Run structured verification cycles with assigned auditors, auto-generated discrepancy reports, and transactional close."
      features={[
        { label: "Create audit cycles", desc: "Scope by department or location, set date range" },
        { label: "Assign auditors", desc: "One or more auditors per cycle" },
        { label: "Verdicts & discrepancies", desc: "Verified / Missing / Damaged with auto-generated reports" },
        { label: "Close cycle", desc: "Lock cycle, set missing → lost, update damaged conditions" },
      ]}
      ctaHref="/assets"
      ctaLabel="View asset directory"
    />
  );
}
