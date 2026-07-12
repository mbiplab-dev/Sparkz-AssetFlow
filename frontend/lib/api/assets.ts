import { authRequest } from "@/lib/api/client";

export type AssetStatus =
  | "available"
  | "allocated"
  | "reserved"
  | "under_maintenance"
  | "lost"
  | "retired"
  | "disposed";

export type AssetCondition = "new" | "good" | "fair" | "poor" | "damaged";

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  available: "Available",
  allocated: "Allocated",
  reserved: "Reserved",
  under_maintenance: "Under Maintenance",
  lost: "Lost",
  retired: "Retired",
  disposed: "Disposed",
};

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
};

export type Asset = {
  id: number;
  asset_tag: string;
  name: string;
  category: number;
  category_name: string;
  serial_number: string;
  qr_code: string;
  acquisition_date: string | null;
  acquisition_cost: string | null;
  condition: AssetCondition;
  condition_label: string;
  status: AssetStatus;
  status_label: string;
  location: number | null;
  location_name: string | null;
  department: number | null;
  department_name: string | null;
  is_bookable: boolean;
  notes: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetInput = {
  name: string;
  category: number;
  serial_number?: string;
  qr_code?: string;
  acquisition_date?: string | null;
  acquisition_cost?: string | null;
  condition?: AssetCondition;
  location?: number | null;
  department?: number | null;
  is_bookable?: boolean;
  notes?: string;
};

export type Category = {
  id: number;
  name: string;
  description: string;
  status: "active" | "inactive";
  created_at: string;
};

export type Department = {
  id: number;
  name: string;
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

export async function listAssets(params?: {
  search?: string;
  status?: AssetStatus;
  category?: string;
  department?: string;
  is_bookable?: string;
}): Promise<Asset[]> {
  return (await authRequest(withQuery("/api/assets/assets/", params))) as Asset[];
}

export async function getAsset(id: number): Promise<Asset> {
  return (await authRequest(`/api/assets/assets/${id}/`)) as Asset;
}

export async function createAsset(input: AssetInput): Promise<Asset> {
  return (await authRequest("/api/assets/assets/", {
    method: "POST",
    body: JSON.stringify(input),
  })) as Asset;
}

export async function updateAsset(id: number, input: Partial<AssetInput>): Promise<Asset> {
  return (await authRequest(`/api/assets/assets/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as Asset;
}

export async function updateAssetStatus(id: number, status: AssetStatus): Promise<Asset> {
  return (await authRequest(`/api/assets/assets/${id}/status/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })) as Asset;
}

export async function deleteAsset(id: number): Promise<void> {
  await authRequest(`/api/assets/assets/${id}/`, { method: "DELETE" });
}

export async function listCategoriesSimple(): Promise<Category[]> {
  return (await authRequest("/api/org/categories/")) as Category[];
}

export async function listDepartmentsSimple(): Promise<Department[]> {
  return (await authRequest("/api/org/departments/")) as Department[];
}
