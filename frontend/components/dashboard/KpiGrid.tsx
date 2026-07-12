import type { DashboardKPIs } from "@/lib/api/dashboard";
import type { UserRole } from "@/lib/auth/authApi";
import { DomainIcons, DomainTints } from "@/components/icons";
import { KpiCard, type KpiCardSpec } from "./KpiCard";

export const KPI_CARDS: KpiCardSpec[] = [
  {
    key: "assets_available",
    label: "Assets Available",
    href: "/assets",
    icon: DomainIcons.assetsOk,
    ...DomainTints.green,
  },
  {
    key: "assets_allocated",
    label: "Assets Allocated",
    href: "/allocation",
    icon: DomainIcons.assets,
    ...DomainTints.sky,
  },
  {
    key: "maintenance_today",
    label: "Open Maintenance",
    href: "/maintenance",
    icon: DomainIcons.maintenance,
    ...DomainTints.orange,
  },
  {
    key: "active_bookings",
    label: "Active Bookings",
    href: "/booking",
    icon: DomainIcons.booking,
    ...DomainTints.teal,
  },
  {
    key: "pending_transfers",
    label: "Pending Requests",
    href: "/allocation",
    icon: DomainIcons.allocation,
    ...DomainTints.purple,
  },
  {
    key: "upcoming_returns",
    label: "Items Checked Out",
    href: "/allocation",
    icon: DomainIcons.assetsOut,
    ...DomainTints.pink,
  },
];

/** Employee-facing labels: personal scope, not org-wide ops. */
const EMPLOYEE_KPI_CARDS: KpiCardSpec[] = [
  {
    key: "assets_allocated",
    label: "Allocated to me",
    href: "/allocation",
    icon: DomainIcons.assets,
    ...DomainTints.sky,
  },
  {
    key: "assets_available",
    label: "Bookable resources",
    href: "/booking",
    icon: DomainIcons.assetsOk,
    ...DomainTints.green,
  },
  {
    key: "maintenance_today",
    label: "My open tickets",
    href: "/maintenance",
    icon: DomainIcons.maintenance,
    ...DomainTints.orange,
  },
  {
    key: "active_bookings",
    label: "My bookings",
    href: "/booking",
    icon: DomainIcons.booking,
    ...DomainTints.teal,
  },
  {
    key: "upcoming_returns",
    label: "To return",
    href: "/allocation",
    icon: DomainIcons.return,
    ...DomainTints.pink,
  },
];

export function KpiGrid({ kpis, role }: { kpis: DashboardKPIs | null; role?: UserRole | null }) {
  const cards = role === "employee" ? EMPLOYEE_KPI_CARDS : KPI_CARDS;
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:grid-cols-3">
      {cards.map((spec, i) => (
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
