/**
 * Audit API client — talks to Django `apps.audits` at `/api/audits/…`.
 * UI code should import only from this module.
 */

import { authRequest } from "@/lib/api/client";
import type {
  AuditCycle,
  AuditDiscrepancy,
  AuditItem,
  AuditVerdict,
  CreateAuditCycleInput,
} from "@/lib/api/audits.types";

export type {
  AuditAuditor,
  AuditCycle,
  AuditCycleStatus,
  AuditDiscrepancy,
  AuditItem,
  AuditVerdict,
  CreateAuditCycleInput,
  DiscrepancyKind,
} from "@/lib/api/audits.types";

export {
  CYCLE_STATUS_LABELS,
  DISCREPANCY_KIND_LABELS,
  VERDICT_LABELS,
} from "@/lib/api/audits.types";

const BASE = "/api/audits";

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  // DRF pagination safety
  if (data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export function scopeLabel(cycle: AuditCycle): string {
  return (
    [cycle.scope_department_name, cycle.scope_location_name].filter(Boolean).join(" · ") || "—"
  );
}

export function isCycleAuditor(
  cycle: AuditCycle,
  userId: string | number | undefined | null,
): boolean {
  if (userId === undefined || userId === null || userId === "") return false;
  const id = Number(userId);
  if (!Number.isFinite(id)) return false;
  return cycle.auditors.some((a) => a.id === id);
}

/** GET /api/audits/cycles/ — backend scopes employees to assigned cycles. */
export async function listAuditCycles(): Promise<AuditCycle[]> {
  return asList<AuditCycle>(await authRequest(`${BASE}/cycles/`));
}

/** GET /api/audits/cycles/:id/ */
export async function getAuditCycle(id: number): Promise<AuditCycle> {
  return (await authRequest(`${BASE}/cycles/${id}/`)) as AuditCycle;
}

/** POST /api/audits/cycles/ — snapshots in-scope assets as pending items. */
export async function createAuditCycle(input: CreateAuditCycleInput): Promise<AuditCycle> {
  return (await authRequest(`${BASE}/cycles/`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      scope_department: input.scope_department,
      scope_location: input.scope_location,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      auditor_ids: input.auditor_ids,
    }),
  })) as AuditCycle;
}

/** POST /api/audits/cycles/:id/close/ — locks cycle; missing→lost, damaged→condition. */
export async function closeAuditCycle(id: number): Promise<AuditCycle> {
  return (await authRequest(`${BASE}/cycles/${id}/close/`, {
    method: "POST",
  })) as AuditCycle;
}

/** POST /api/audits/cycles/:id/auditors/ — replace full auditor list (employees only). */
export async function setCycleAuditors(cycleId: number, auditorIds: number[]): Promise<AuditCycle> {
  return (await authRequest(`${BASE}/cycles/${cycleId}/auditors/`, {
    method: "POST",
    body: JSON.stringify({ auditor_ids: auditorIds }),
  })) as AuditCycle;
}

/** GET /api/audits/items/?cycle= */
export async function listAuditItems(cycleId: number): Promise<AuditItem[]> {
  return asList<AuditItem>(
    await authRequest(`${BASE}/items/?cycle=${encodeURIComponent(String(cycleId))}`),
  );
}

/**
 * PATCH /api/audits/items/:id/verdict/
 * Verdict must be verified | missing | damaged (not pending).
 */
export async function updateAuditItemVerdict(
  itemId: number,
  verdict: Exclude<AuditVerdict, "pending">,
  notes?: string,
): Promise<AuditItem> {
  return (await authRequest(`${BASE}/items/${itemId}/verdict/`, {
    method: "PATCH",
    body: JSON.stringify({
      verdict,
      notes: notes ?? "",
    }),
  })) as AuditItem;
}

/** GET /api/audits/discrepancies/?cycle=&resolved= */
export async function listDiscrepancies(params?: {
  cycle?: number;
  resolved?: boolean;
}): Promise<AuditDiscrepancy[]> {
  const search = new URLSearchParams();
  if (params?.cycle != null) search.set("cycle", String(params.cycle));
  if (params?.resolved != null) search.set("resolved", params.resolved ? "true" : "false");
  const qs = search.toString();
  const url = qs ? `${BASE}/discrepancies/?${qs}` : `${BASE}/discrepancies/`;
  return asList<AuditDiscrepancy>(await authRequest(url));
}

/** POST /api/audits/discrepancies/:id/resolve/ */
export async function resolveDiscrepancy(id: number): Promise<AuditDiscrepancy> {
  return (await authRequest(`${BASE}/discrepancies/${id}/resolve/`, {
    method: "POST",
  })) as AuditDiscrepancy;
}
