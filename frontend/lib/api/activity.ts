import { authRequest } from "@/lib/api/client";

export type ActivityLog = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  message: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  actor: number | null;
  actor_name: string | null;
  actor_email: string | null;
  ip_addr: string | null;
  created_at: string;
};

export type ActivityListParams = {
  action?: string;
  entity_type?: string;
  search?: string;
};

function qs(params?: ActivityListParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.action) sp.set("action", params.action);
  if (params.entity_type) sp.set("entity_type", params.entity_type);
  if (params.search) sp.set("search", params.search);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** DRF may return a bare array or a paginated `{ results: [] }` payload. */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export async function listActivityLogs(params?: ActivityListParams): Promise<ActivityLog[]> {
  const data = await authRequest(`/api/activity/${qs(params)}`);
  return unwrapList<ActivityLog>(data);
}
