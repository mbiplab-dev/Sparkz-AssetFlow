/**
 * Audit API client — the ONLY module UI code should import for audits.
 *
 * Pattern matches `lib/api/assets.ts` / `maintenance.ts`.
 *
 * Backend not shipped yet → `USE_LOCAL_AUDIT_API = true` routes through
 * `audits.local.ts`. When Django exposes `/api/audits/…`:
 *   1. Set USE_LOCAL_AUDIT_API = false
 *   2. Confirm paths match the real routes (TODO markers below)
 *   3. Delete `audits.local.ts`
 */

import { authRequest } from "@/lib/api/client";
import {
  localCloseCycle,
  localCreateCycle,
  localGetCycle,
  localListCycles,
  localStartCycle,
  localUpdateItemVerdict,
} from "@/lib/api/audits.local";
import type {
  ActorRef,
  AuditCycle,
  AuditDiscrepancy,
  AuditVerdict,
  CreateAuditCycleInput,
  DiscrepancyKind,
} from "@/lib/api/audits.types";

export type {
  ActorRef,
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

// ── Flip this when the audits backend is ready ─────────────────────────────
const USE_LOCAL_AUDIT_API = true;

// ── Pure UI helpers (no mock / no network) ─────────────────────────────────

/** Derive discrepancy list from items (until API returns audit_discrepancies). */
export function discrepanciesFromCycle(cycle: AuditCycle): AuditDiscrepancy[] {
  return cycle.items
    .filter((i) => i.verdict === "missing" || i.verdict === "damaged")
    .map((i) => {
      const kind: DiscrepancyKind =
        i.verdict === "damaged"
          ? "damaged"
          : /wrong.?loc|not at|misplaced/i.test(i.notes)
            ? "wrong_location"
            : "missing";
      return {
        id: `disc-${i.id}`,
        audit_item_id: i.id,
        asset_tag: i.asset_tag,
        asset_name: i.asset_name,
        kind,
        detail:
          i.notes ||
          (kind === "missing"
            ? "Asset not found in scoped location"
            : kind === "damaged"
              ? "Condition issue recorded during audit"
              : "Asset found outside expected location"),
        resolved: cycle.status === "closed",
        resolved_by_name: cycle.status === "closed" ? cycle.closed_by_name : null,
        resolved_at: cycle.status === "closed" ? cycle.closed_at : null,
        created_at: i.verified_at || cycle.created_at,
      };
    });
}

export function scopeLabel(cycle: AuditCycle): string {
  return [cycle.scope_dept_name, cycle.scope_loc_name].filter(Boolean).join(" · ") || "—";
}

// ── Public API ─────────────────────────────────────────────────────────────

/** GET /api/audits/cycles/ */
export async function listAuditCycles(_signal?: AbortSignal): Promise<AuditCycle[]> {
  if (USE_LOCAL_AUDIT_API) return localListCycles();

  // TODO(api): pass signal when http layer supports it
  return (await authRequest("/api/audits/cycles/")) as AuditCycle[];
}

/** GET /api/audits/cycles/:id/ */
export async function getAuditCycle(id: string): Promise<AuditCycle> {
  if (USE_LOCAL_AUDIT_API) return localGetCycle(id);

  return (await authRequest(`/api/audits/cycles/${id}/`)) as AuditCycle;
}

/** POST /api/audits/cycles/ */
export async function createAuditCycle(
  input: CreateAuditCycleInput,
  actor: ActorRef,
): Promise<AuditCycle> {
  if (USE_LOCAL_AUDIT_API) return localCreateCycle(input, actor);

  return (await authRequest("/api/audits/cycles/", {
    method: "POST",
    body: JSON.stringify(input),
  })) as AuditCycle;
}

/** POST /api/audits/cycles/:id/start/ */
export async function startAuditCycle(id: string): Promise<AuditCycle> {
  if (USE_LOCAL_AUDIT_API) return localStartCycle(id);

  return (await authRequest(`/api/audits/cycles/${id}/start/`, {
    method: "POST",
  })) as AuditCycle;
}

/** POST /api/audits/cycles/:id/close/ */
export async function closeAuditCycle(id: string, actor: ActorRef): Promise<AuditCycle> {
  if (USE_LOCAL_AUDIT_API) return localCloseCycle(id, actor);

  return (await authRequest(`/api/audits/cycles/${id}/close/`, {
    method: "POST",
  })) as AuditCycle;
}

/** PATCH /api/audits/cycles/:cycleId/items/:itemId/ */
export async function updateAuditItemVerdict(
  cycleId: string,
  itemId: string,
  verdict: AuditVerdict,
  notes: string | undefined,
  actor: ActorRef,
): Promise<AuditCycle> {
  if (USE_LOCAL_AUDIT_API) {
    return localUpdateItemVerdict(cycleId, itemId, verdict, notes, actor);
  }

  return (await authRequest(`/api/audits/cycles/${cycleId}/items/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify({ verdict, notes }),
  })) as AuditCycle;
}

/** True while the local stand-in is active (small UI footnote only). */
export function isAuditApiLocal(): boolean {
  return USE_LOCAL_AUDIT_API;
}
