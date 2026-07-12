/**
 * Canonical domain icons for AssetFlow.
 * Prefer these over ad-hoc Lucide picks so nav, KPIs, activity, and empty
 * states stay visually coherent.
 */
import {
  Activity,
  ArrowRightLeft,
  BellRing,
  Building2,
  CalendarRange,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  ClockAlert,
  FileChartColumn,
  Gauge,
  History,
  ListChecks,
  Package2,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  ToolCase,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export const DomainIcons = {
  dashboard: Gauge,
  organization: Building2,
  assets: Package2,
  assetsWarehouse: Warehouse,
  assetsRegister: PackagePlus,
  assetsOk: PackageCheck,
  assetsOut: PackageOpen,
  allocation: ArrowRightLeft,
  booking: CalendarRange,
  maintenance: ToolCase,
  audit: ListChecks,
  auditCycle: ClipboardCheck,
  reports: ChartColumn,
  reportsFile: FileChartColumn,
  activity: History,
  activityDetail: ScrollText,
  notifications: BellRing,
  overdue: ClockAlert,
  people: UsersRound,
  secure: ShieldCheck,
  success: CircleCheck,
  return: RotateCcw,
  pulse: Activity,
} as const satisfies Record<string, LucideIcon>;

export type DomainIconKey = keyof typeof DomainIcons;

/** Soft tint + background pairs aligned with the design tokens. */
export const DomainTints = {
  green: { tint: "text-accent-green", bg: "bg-accent-green/15" },
  sky: { tint: "text-accent-sky", bg: "bg-accent-sky/15" },
  teal: { tint: "text-accent-teal", bg: "bg-accent-teal/15" },
  orange: { tint: "text-accent-orange", bg: "bg-accent-orange/15" },
  purple: { tint: "text-accent-purple-deep", bg: "bg-accent-purple/25" },
  pink: { tint: "text-accent-pink", bg: "bg-accent-pink/15" },
  brown: { tint: "text-accent-brown", bg: "bg-accent-brown/15" },
  danger: { tint: "text-destructive", bg: "bg-destructive/10" },
  muted: { tint: "text-ink-muted", bg: "bg-muted" },
  primary: { tint: "text-primary", bg: "bg-primary/10" },
} as const;
