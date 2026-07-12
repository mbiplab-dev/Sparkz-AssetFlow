import { authRequest } from "@/lib/api/client";

// ── Types matching backend `apps.resource_allocation` serializers ────────

export type HolderType = "manager" | "department" | "employee";

export type RequestStatus =
  | "open"
  | "partially_fulfilled"
  | "fulfilled"
  | "rejected"
  | "cancelled";

export type TransferKind =
  | "allocate"
  | "sub_allocate"
  | "fulfill_request"
  | "peer_transfer"
  | "return";

/** Quantity-tracked asset in the resource_allocation catalog. */
export type ResourceAsset = {
  id: number;
  name: string;
  category: number;
  category_name: string;
  total_quantity: number;
  condition: string;
  location: string;
  is_bookable: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
};

/** Current-state view of who holds how much of an asset (see HoldingSerializer). */
export type Holding = {
  id: number;
  asset: number;
  asset_name: string;
  holder_type: HolderType;
  holder_id: number;
  quantity: number;
};

export type Transfer = {
  id: number;
  asset: number;
  asset_name: string;
  from_holder_type: HolderType;
  from_holder_id: number;
  to_holder_type: HolderType;
  to_holder_id: number;
  quantity: number;
  kind: TransferKind;
  request: number | null;
  performed_by: number;
  notes: string;
  created_at: string;
};

export type AllocationRequest = {
  id: number;
  asset: number;
  asset_name: string;
  requested_by: number;
  requested_by_name: string;
  for_holder_type: HolderType;
  for_holder_id: number;
  quantity_requested: number;
  quantity_fulfilled: number;
  remaining: number;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
};

// ── Request payloads ─────────────────────────────────────────────────────

export type AllocateInput = {
  asset: number;
  to_holder_type: HolderType;
  to_holder_id: number;
  quantity: number;
};

export type ReturnInput = {
  asset: number;
  quantity: number;
};

export type CreateRequestInput = {
  asset: number;
  for_holder_type: HolderType;
  for_holder_id: number;
  quantity_requested: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────

function withQuery(base: string, params?: Record<string, string | undefined>): string {
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

const BASE = "/api/resources";

// ── Resource assets (quantity-tracked catalog) ───────────────────────────

export async function listResourceAssets(params?: {
  search?: string;
  category?: string;
}): Promise<ResourceAsset[]> {
  return (await authRequest(withQuery(`${BASE}/assets/`, params))) as ResourceAsset[];
}

// ── Holdings ─────────────────────────────────────────────────────────────

export async function listHoldings(params?: { asset?: string }): Promise<Holding[]> {
  return (await authRequest(withQuery(`${BASE}/holdings/`, params))) as Holding[];
}

export async function getHolding(id: number): Promise<Holding> {
  return (await authRequest(`${BASE}/holdings/${id}/`)) as Holding;
}

// ── Transfers (read-only ledger) ─────────────────────────────────────────

export async function listTransfers(params?: { asset?: string }): Promise<Transfer[]> {
  return (await authRequest(withQuery(`${BASE}/transfers/`, params))) as Transfer[];
}

export async function getTransfer(id: number): Promise<Transfer> {
  return (await authRequest(`${BASE}/transfers/${id}/`)) as Transfer;
}

// ── Allocation requests ──────────────────────────────────────────────────

export async function listAllocationRequests(): Promise<AllocationRequest[]> {
  return (await authRequest(`${BASE}/requests/`)) as AllocationRequest[];
}

export async function createAllocationRequest(
  input: CreateRequestInput,
): Promise<AllocationRequest> {
  return (await authRequest(`${BASE}/requests/`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as AllocationRequest;
}

export async function fulfillAllocationRequest(
  id: number,
  quantity: number,
): Promise<AllocationRequest> {
  return (await authRequest(`${BASE}/requests/${id}/fulfill/`, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  })) as AllocationRequest;
}

export async function rejectAllocationRequest(id: number): Promise<AllocationRequest> {
  return (await authRequest(`${BASE}/requests/${id}/reject/`, {
    method: "POST",
  })) as AllocationRequest;
}

export async function cancelAllocationRequest(id: number): Promise<AllocationRequest> {
  return (await authRequest(`${BASE}/requests/${id}/cancel/`, {
    method: "POST",
  })) as AllocationRequest;
}

// ── Allocate & Return ────────────────────────────────────────────────────

export async function allocateAsset(input: AllocateInput): Promise<{ detail: string }> {
  return (await authRequest(`${BASE}/allocate/`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as { detail: string };
}

export async function returnAsset(input: ReturnInput): Promise<{ detail: string }> {
  return (await authRequest(`${BASE}/return/`, {
    method: "POST",
    body: JSON.stringify(input),
  })) as { detail: string };
}
