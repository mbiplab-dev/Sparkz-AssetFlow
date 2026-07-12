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
