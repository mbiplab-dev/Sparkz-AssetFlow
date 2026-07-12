import { ArrowLeftRight, Boxes, CalendarClock, CircleCheckBig, Undo2, Wrench } from "lucide-react";
import type { DashboardKPIs } from "@/lib/api/dashboard";
import { KpiCard, type KpiCardSpec } from "./KpiCard";

export const KPI_CARDS: KpiCardSpec[] = [
  {
    key: "assets_available",
    label: "Assets Available",
    href: "/assets",
    icon: CircleCheckBig,
    tint: "text-accent-green",
    bg: "bg-accent-green/15",
  },
  {
    key: "assets_allocated",
    label: "Assets Allocated",
    href: "/allocation",
    icon: Boxes,
    tint: "text-accent-sky",
    bg: "bg-accent-sky/15",
  },
  {
    key: "maintenance_today",
    label: "Maintenance Today",
    href: "/maintenance",
    icon: Wrench,
    tint: "text-accent-orange",
    bg: "bg-accent-orange/15",
  },
  {
    key: "active_bookings",
    label: "Active Bookings",
    href: "/booking",
    icon: CalendarClock,
    tint: "text-accent-teal",
    bg: "bg-accent-teal/15",
  },
  {
    key: "pending_transfers",
    label: "Pending Transfers",
    href: "/allocation",
    icon: ArrowLeftRight,
    tint: "text-accent-purple-deep",
    bg: "bg-accent-purple/25",
  },
  {
    key: "upcoming_returns",
    label: "Upcoming Returns",
    href: "/allocation",
    icon: Undo2,
    tint: "text-accent-pink",
    bg: "bg-accent-pink/15",
  },
];

export function KpiGrid({ kpis }: { kpis: DashboardKPIs | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3">
      {KPI_CARDS.map((spec, i) => (
        <div
          key={spec.key}
          className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both ease-out"
          style={{ animationDuration: "450ms", animationDelay: `${i * 60}ms` }}
        >
          <KpiCard spec={spec} value={kpis ? kpis[spec.key as keyof DashboardKPIs] : null} />
        </div>
      ))}
    </div>
  );
}
