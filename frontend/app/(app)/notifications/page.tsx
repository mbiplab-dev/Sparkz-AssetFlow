"use client";

import { Bell } from "lucide-react";
import { ModuleScreen } from "@/components/ModuleScreen";

export default function NotificationsPage() {
  return (
    <ModuleScreen
      icon={Bell}
      title="Notifications & Activity Log"
      description="Stay informed without digging — real-time alerts for assignments, approvals, bookings, overdue returns, and audit discrepancies."
      features={[
        { label: "Asset assigned", desc: "When an asset is allocated to you or your department" },
        { label: "Maintenance updates", desc: "Approved, rejected, or resolved maintenance requests" },
        { label: "Booking alerts", desc: "Confirmed, cancelled, and reminder notifications for bookings" },
        { label: "Overdue returns", desc: "Auto-flagged when expected return dates pass" },
        { label: "Audit discrepancies", desc: "Flagged when assets are marked missing or damaged" },
        { label: "Activity log", desc: "Full audit trail of who did what, when" },
      ]}
      ctaHref="/dashboard"
      ctaLabel="Back to dashboard"
    />
  );
}
