/**
 * Audit domain types aligned with backend `apps.audits`
 * (open/closed cycles, real items + discrepancies endpoints).
 */

export type AuditCycleStatus = "open" | "closed";
export type AuditVerdict = "pending" | "verified" | "missing" | "damaged";
export type DiscrepancyKind = "missing" | "damaged";

export type AuditAuditor = {
  id: number;
  full_name: string;
};

export type AuditItem = {
  id: number;
  cycle: number;
  asset: number;
  asset_tag: string;
  asset_name: string;
  expected_location_id: number | null;
  expected_location_name: string | null;
  verdict: AuditVerdict;
  notes: string;
  verified_by: number | null;
  verified_by_name: string | null;
  verified_at: string | null;
};

/** List/retrieve cycle row (items loaded separately). */
export type AuditCycle = {
  id: number;
  name: string;
  scope_department: number | null;
  scope_department_name: string | null;
  scope_location: number | null;
  scope_location_name: string | null;
  starts_on: string;
  ends_on: string;
  status: AuditCycleStatus;
  auditors: AuditAuditor[];
  created_by: number;
  created_by_name: string;
  closed_by: number | null;
  closed_by_name: string | null;
  closed_at: string | null;
  created_at: string;
  items_total?: number;
  items_pending?: number;
  items_done?: number;
  open_discrepancies?: number;
};

export type AuditDiscrepancy = {
  id: number;
  audit_item: number;
  cycle: number;
  asset_tag: string;
  asset_name: string;
  kind: DiscrepancyKind;
  detail: string;
  resolved: boolean;
  resolved_by: number | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type CreateAuditCycleInput = {
  name: string;
  scope_department: number | null;
  scope_location: number | null;
  starts_on: string;
  ends_on: string;
  auditor_ids: number[];
};

export const CYCLE_STATUS_LABELS: Record<AuditCycleStatus, string> = {
  open: "Open",
  closed: "Closed",
};

export const VERDICT_LABELS: Record<AuditVerdict, string> = {
  pending: "Pending",
  verified: "Verified",
  missing: "Missing",
  damaged: "Damaged",
};

export const DISCREPANCY_KIND_LABELS: Record<DiscrepancyKind, string> = {
  missing: "Missing",
  damaged: "Damaged",
};
