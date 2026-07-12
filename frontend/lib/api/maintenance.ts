import { authRequest } from "@/lib/api/client";

export type MaintenancePriority = "low" | "medium" | "high" | "critical";

export type MaintenanceStatus =
  "pending" | "approved" | "rejected" | "assigned" | "in_progress" | "resolved" | "cancelled";

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

export type MaintenanceRequest = {
  id: number;
  asset: number;
  asset_tag: string;
  asset_name: string;
  category_name: string;
  raised_by: number;
  raised_by_name: string;
  raised_by_email: string;
  issue_description: string;
  priority: MaintenancePriority;
  priority_label: string;
  status: MaintenanceStatus;
  status_label: string;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string;
  technician: number | null;
  technician_name: string | null;
  assigned_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  resolution_notes: string;
  estimated_cost: string | null;
  actual_cost: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRequestInput = {
  asset: number;
  issue_description: string;
  priority?: MaintenancePriority;
  estimated_cost?: string | null;
};

function withQuery(base: string, params?: Record<string, string | undefined>): string {
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function listMaintenanceRequests(params?: {
  asset?: string;
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  technician?: string;
  starts_on?: string;
  ends_on?: string;
}): Promise<MaintenanceRequest[]> {
  return (await authRequest(
    withQuery("/api/maintenance/requests/", params),
  )) as MaintenanceRequest[];
}

export async function createMaintenanceRequest(
  input: MaintenanceRequestInput,
): Promise<MaintenanceRequest> {
  return (await authRequest("/api/maintenance/requests/", {
    method: "POST",
    body: JSON.stringify(input),
  })) as MaintenanceRequest;
}

export async function approveMaintenance(id: number): Promise<MaintenanceRequest> {
  return (await authRequest(`/api/maintenance/requests/${id}/approve/`, {
    method: "POST",
  })) as MaintenanceRequest;
}

export async function rejectMaintenance(id: number, reason: string): Promise<MaintenanceRequest> {
  return (await authRequest(`/api/maintenance/requests/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })) as MaintenanceRequest;
}

export async function startMaintenance(
  id: number,
  technician?: number | null,
): Promise<MaintenanceRequest> {
  const body: Record<string, unknown> = {};
  if (technician != null) body.technician = technician;
  return (await authRequest(`/api/maintenance/requests/${id}/start/`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as MaintenanceRequest;
}

export async function resolveMaintenance(
  id: number,
  resolution_notes: string,
  actual_cost?: string | null,
): Promise<MaintenanceRequest> {
  const body: Record<string, unknown> = { resolution_notes };
  if (actual_cost != null && actual_cost !== "") body.actual_cost = actual_cost;
  return (await authRequest(`/api/maintenance/requests/${id}/resolve/`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as MaintenanceRequest;
}
