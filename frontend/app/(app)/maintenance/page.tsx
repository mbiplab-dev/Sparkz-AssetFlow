"use client";

import { Wrench } from "lucide-react";
import { ModuleScreen } from "@/components/ModuleScreen";

export default function MaintenancePage() {
  return (
    <ModuleScreen
      icon={Wrench}
      title="Maintenance Management"
      description="Route repair requests through an approval workflow before work begins, with automatic asset status updates."
      features={[
        { label: "Raise requests", desc: "Select asset, describe issue, set priority, attach photos" },
        { label: "Approval workflow", desc: "Pending → Approved/Rejected → Assigned → In Progress → Resolved" },
        { label: "Asset status hooks", desc: "Auto-set 'Under Maintenance' on approval, 'Available' on resolution" },
        { label: "Maintenance history", desc: "Full repair history retained per asset" },
      ]}
      ctaHref="/assets"
      ctaLabel="View asset directory"
    />
  );
}
