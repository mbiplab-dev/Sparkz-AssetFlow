import { authRequest } from "@/lib/api/client";

export type DashboardKPIs = {
  assets_available: number;
  assets_allocated: number;
  maintenance_today: number;
  active_bookings: number;
  pending_transfers: number;
  upcoming_returns: number;
  overdue_returns: number;
};

export type ActivityItem = {
  id: number;
  message: string;
  timestamp: string;
};

export type DashboardSummary = {
  kpis: DashboardKPIs;
  recent_activity: ActivityItem[];
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return (await authRequest("/api/dashboard/summary/")) as DashboardSummary;
}

export type CategoryCount = { category: string; count: number };
export type DepartmentCount = { department: string; count: number };
export type TopUsedAsset = {
  asset_id: number;
  asset_tag: string;
  name: string;
  count: number;
};
export type BookingHourLoad = { hour: number; count: number };

export type DashboardTotals = {
  assets_total: number;
  assets_bookable: number;
  bookings_active: number;
  bookings_total: number;
  maintenance_open: number;
  holdings_out: number;
  resource_pool_units: number;
};

export type DashboardReports = {
  assets_by_status: Record<string, number>;
  assets_by_category: CategoryCount[];
  assets_by_department: DepartmentCount[];
  maintenance_by_status: Record<string, number>;
  maintenance_by_category: CategoryCount[];
  top_used_assets: TopUsedAsset[];
  booking_load_by_hour: BookingHourLoad[];
  overdue_returns_count: number;
  totals?: DashboardTotals;
};

export async function getDashboardReports(): Promise<DashboardReports> {
  return (await authRequest("/api/dashboard/reports/")) as DashboardReports;
}

export type NotificationKind =
  | "maintenance_created"
  | "maintenance_approved"
  | "maintenance_resolved"
  | "booking_created"
  | "booking_cancelled"
  | "asset_allocated"
  | "overdue_return";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  entity: string;
  entity_id: number;
  actor_name?: string | null;
  timestamp: string;
  /** Present when the event represents something past due. */
  is_overdue?: boolean;
};

export async function listNotifications(): Promise<NotificationItem[]> {
  return (await authRequest("/api/dashboard/notifications/")) as NotificationItem[];
}
