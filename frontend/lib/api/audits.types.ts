/**
 * Audit domain types (db-schema.txt §7). Shared by the public client and the
 * temporary local stand-in — no network, no mock store.
 */

export type AuditCycleStatus = "draft" | "in_progress" | "closed";
export type AuditVerdict = "pending" | "verified" | "missing" | "damaged";
export type DiscrepancyKind = "missing" | "damaged" | "wrong_location";

export type AuditAuditor = {
  id: string;
  full_name: string;
};

export type AuditItem = {
  id: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  expected_location_id: string | null;
  expected_location_name: string | null;
  verdict: AuditVerdict;
  notes: string;
  verified_by_id: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
};

export type AuditCycle = {
  id: string;
  name: string;
  scope_dept_id: string | null;
  scope_dept_name: string | null;
  scope_loc_id: string | null;
  scope_loc_name: string | null;
  starts_on: string;
  ends_on: string;
  status: AuditCycleStatus;
  created_by_id: string;
  created_by_name: string;
  closed_at: string | null;
  closed_by_id: string | null;
  closed_by_name: string | null;
  created_at: string;
  auditors: AuditAuditor[];
  items: AuditItem[];
};

export type AuditDiscrepancy = {
  id: string;
  audit_item_id: string;
  asset_tag: string;
  asset_name: string;
  kind: DiscrepancyKind;
  detail: string;
  resolved: boolean;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type CreateAuditCycleInput = {
  name: string;
  scope_dept_id: string | null;
  scope_dept_name: string | null;
  scope_loc_id: string | null;
  scope_loc_name: string | null;
  starts_on: string;
  ends_on: string;
  auditors: AuditAuditor[];
};

export type ActorRef = { id: string; name: string };

export const CYCLE_STATUS_LABELS: Record<AuditCycleStatus, string> = {
  draft: "Draft",
  in_progress: "In progress",
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
  wrong_location: "Wrong location",
};
