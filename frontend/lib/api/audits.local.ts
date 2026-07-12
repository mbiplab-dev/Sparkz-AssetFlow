/**
 * TEMPORARY local stand-in for the audits backend.
 *
 * ⚠️  Only imported by `lib/api/audits.ts` while USE_LOCAL_AUDIT_API is true.
 * ⚠️  Do NOT import this file from pages or components.
 * ⚠️  When the Django audits API ships, flip USE_LOCAL_AUDIT_API off in audits.ts
 *     and delete this file.
 */

import type {
  AuditCycle,
  AuditItem,
  AuditVerdict,
  CreateAuditCycleInput,
} from "./audits.types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedItem(
  tag: string,
  name: string,
  loc: { id: string; name: string },
  verdict: AuditVerdict,
  verifiedBy?: string,
  verifiedAt?: string,
  notes = "",
): AuditItem {
  return {
    id: uid("it"),
    asset_id: uid("asset"),
    asset_tag: tag,
    asset_name: name,
    expected_location_id: loc.id,
    expected_location_name: loc.name,
    verdict,
    notes,
    verified_by_id: verifiedBy ? uid("user") : null,
    verified_by_name: verifiedBy ?? null,
    verified_at: verifiedAt ?? null,
  };
}

function buildSeed(): AuditCycle[] {
  const locEast = { id: "loc-east-3", name: "HQ East · Floor 3" };
  const locYard = { id: "loc-yard-a", name: "Fleet Yard A" };
  const locWest = { id: "loc-west", name: "HQ West" };

  return [
    {
      id: "cyc-001",
      name: "Q2 Floor audit — HQ East",
      scope_dept_id: "dept-eng",
      scope_dept_name: "Engineering",
      scope_loc_id: locEast.id,
      scope_loc_name: locEast.name,
      starts_on: "2026-06-01",
      ends_on: "2026-06-14",
      status: "in_progress",
      created_by_id: "user-mgr",
      created_by_name: "Alex Manager",
      closed_at: null,
      closed_by_id: null,
      closed_by_name: null,
      created_at: "2026-05-28T09:00:00Z",
      auditors: [
        { id: "user-priya", full_name: "Priya Shah" },
        { id: "user-jordan", full_name: "Jordan Lee" },
      ],
      items: [
        seedItem("AF-0014", "MacBook Pro 14″", locEast, "verified", "Priya Shah", "2026-06-03T10:20:00Z"),
        seedItem("AF-0022", "Dell UltraSharp 27″", locEast, "pending"),
        seedItem(
          "AF-0031",
          "Standing desk — oak",
          locEast,
          "missing",
          "Jordan Lee",
          "2026-06-04T15:00:00Z",
          "Not at assigned bay",
        ),
        seedItem(
          "AF-0040",
          "Logitech MX Keys",
          locEast,
          "damaged",
          "Priya Shah",
          "2026-06-05T09:10:00Z",
          "Keycaps worn; needs replacement",
        ),
        seedItem("AF-0055", "Conference cam Meet 4K", locEast, "pending"),
      ],
    },
    {
      id: "cyc-002",
      name: "Vehicles — fleet yard A",
      scope_dept_id: "dept-ops",
      scope_dept_name: "Operations",
      scope_loc_id: locYard.id,
      scope_loc_name: locYard.name,
      starts_on: "2026-05-10",
      ends_on: "2026-05-20",
      status: "closed",
      created_by_id: "user-mgr",
      created_by_name: "Alex Manager",
      closed_at: "2026-05-21T16:00:00Z",
      closed_by_id: "user-mgr",
      closed_by_name: "Alex Manager",
      created_at: "2026-05-08T11:00:00Z",
      auditors: [{ id: "user-sam", full_name: "Sam Ortiz" }],
      items: [
        seedItem("AF-0101", "Van — Transit 250", locYard, "verified", "Sam Ortiz", "2026-05-12T11:00:00Z"),
        seedItem("AF-0108", "Pickup — F-150", locYard, "verified", "Sam Ortiz", "2026-05-12T12:30:00Z"),
      ],
    },
    {
      id: "cyc-003",
      name: "Furniture sweep — West wing",
      scope_dept_id: null,
      scope_dept_name: null,
      scope_loc_id: locWest.id,
      scope_loc_name: locWest.name,
      starts_on: "2026-07-01",
      ends_on: "2026-07-15",
      status: "draft",
      created_by_id: "user-mgr",
      created_by_name: "Alex Manager",
      closed_at: null,
      closed_by_id: null,
      closed_by_name: null,
      created_at: "2026-06-25T14:00:00Z",
      auditors: [{ id: "user-morgan", full_name: "Morgan Blake" }],
      items: [
        seedItem("AF-0201", "Ergo chair Aeron", locWest, "pending"),
        seedItem("AF-0204", "Whiteboard 6×4", locWest, "pending"),
        seedItem("AF-0210", "Storage locker set", locWest, "pending"),
      ],
    },
  ];
}

/** Module-level store so mutations survive reloads of the page component (dev session). */
let store: AuditCycle[] | null = null;

function db(): AuditCycle[] {
  if (!store) store = buildSeed();
  return store;
}

function cloneCycle(c: AuditCycle): AuditCycle {
  return {
    ...c,
    auditors: c.auditors.map((a) => ({ ...a })),
    items: c.items.map((i) => ({ ...i })),
  };
}

export async function localListCycles(): Promise<AuditCycle[]> {
  return db().map(cloneCycle);
}

export async function localGetCycle(id: string): Promise<AuditCycle> {
  const found = db().find((c) => c.id === id);
  if (!found) throw new Error("Audit cycle not found.");
  return cloneCycle(found);
}

export async function localCreateCycle(
  input: CreateAuditCycleInput,
  actor: { id: string; name: string },
): Promise<AuditCycle> {
  const cycle: AuditCycle = {
    id: uid("cyc"),
    name: input.name,
    scope_dept_id: input.scope_dept_id,
    scope_dept_name: input.scope_dept_name,
    scope_loc_id: input.scope_loc_id,
    scope_loc_name: input.scope_loc_name,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    status: "draft",
    created_by_id: actor.id,
    created_by_name: actor.name,
    closed_at: null,
    closed_by_id: null,
    closed_by_name: null,
    created_at: new Date().toISOString(),
    auditors: input.auditors.map((a) => ({ ...a })),
    items: [],
  };
  store = [cycle, ...db()];
  return cloneCycle(cycle);
}

export async function localStartCycle(id: string): Promise<AuditCycle> {
  const list = db();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Audit cycle not found.");
  const c = list[idx];
  if (c.status !== "draft") throw new Error("Only draft cycles can be started.");

  const items: AuditItem[] =
    c.items.length > 0
      ? c.items
      : [
          seedItem(
            "AF-NEW-01",
            "Scoped asset A",
            {
              id: c.scope_loc_id ?? "loc-unknown",
              name: c.scope_loc_name ?? "Unknown",
            },
            "pending",
          ),
          seedItem(
            "AF-NEW-02",
            "Scoped asset B",
            {
              id: c.scope_loc_id ?? "loc-unknown",
              name: c.scope_loc_name ?? "Unknown",
            },
            "pending",
          ),
        ];

  const next = { ...c, status: "in_progress" as const, items };
  list[idx] = next;
  return cloneCycle(next);
}

export async function localCloseCycle(
  id: string,
  actor: { id: string; name: string },
): Promise<AuditCycle> {
  const list = db();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error("Audit cycle not found.");
  const c = list[idx];
  if (c.status !== "in_progress") throw new Error("Only in-progress cycles can be closed.");
  if (c.items.some((i) => i.verdict === "pending")) {
    throw new Error("All items must leave pending before close.");
  }
  const next: AuditCycle = {
    ...c,
    status: "closed",
    closed_at: new Date().toISOString(),
    closed_by_id: actor.id,
    closed_by_name: actor.name,
  };
  list[idx] = next;
  return cloneCycle(next);
}

export async function localUpdateItemVerdict(
  cycleId: string,
  itemId: string,
  verdict: AuditVerdict,
  notes: string | undefined,
  actor: { id: string; name: string },
): Promise<AuditCycle> {
  const list = db();
  const idx = list.findIndex((c) => c.id === cycleId);
  if (idx < 0) throw new Error("Audit cycle not found.");
  const c = list[idx];
  if (c.status !== "in_progress") throw new Error("Items can only be updated while in progress.");

  const next: AuditCycle = {
    ...c,
    items: c.items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            verdict,
            notes: notes !== undefined ? notes : i.notes,
            verified_by_id: verdict === "pending" ? null : actor.id,
            verified_by_name: verdict === "pending" ? null : actor.name,
            verified_at: verdict === "pending" ? null : new Date().toISOString(),
          }
        : i,
    ),
  };
  list[idx] = next;
  return cloneCycle(next);
}
