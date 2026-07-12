import { authRequest } from "@/lib/api/client";

export type OrgStatus = "active" | "inactive";

export type Department = {
  id: number;
  name: string;
  code: string;
  parent: number | null;
  parent_name: string | null;
  head: number | null;
  head_name: string | null;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
};

export type DepartmentInput = {
  name: string;
  code?: string;
  parent?: number | null;
  head?: number | null;
  status?: OrgStatus;
};

export type AssetCategory = {
  id: number;
  name: string;
  description: string;
  custom_fields_schema: Record<string, unknown>;
  status: OrgStatus;
  created_at: string;
};

export type CategoryInput = {
  name: string;
  description?: string;
  custom_fields_schema?: Record<string, unknown>;
  status?: OrgStatus;
};

export type EmployeeRole = "admin" | "asset_manager" | "department_head" | "employee";

export type Employee = {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: EmployeeRole;
  status: OrgStatus;
  department: number | null;
  department_name: string | null;
  date_joined: string;
};

async function getJSON(path: string): Promise<unknown> {
  return authRequest(path);
}

async function sendJSON(path: string, method: string, body?: unknown): Promise<unknown> {
  return authRequest(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function withQuery(base: string, params?: Record<string, string | undefined>): string {
  if (!params) return base;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

// ── Departments ──────────────────────────────────────────────────────────

export async function listDepartments(params?: {
  search?: string;
  status?: OrgStatus;
}): Promise<Department[]> {
  return (await getJSON(withQuery("/api/org/departments/", params))) as Department[];
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  return (await sendJSON("/api/org/departments/", "POST", input)) as Department;
}

export async function updateDepartment(
  id: number,
  input: Partial<DepartmentInput>,
): Promise<Department> {
  return (await sendJSON(`/api/org/departments/${id}/`, "PATCH", input)) as Department;
}

export async function deactivateDepartment(id: number): Promise<void> {
  await sendJSON(`/api/org/departments/${id}/`, "DELETE");
}

// ── Asset Categories ─────────────────────────────────────────────────────

export async function listCategories(params?: {
  search?: string;
  status?: OrgStatus;
}): Promise<AssetCategory[]> {
  return (await getJSON(withQuery("/api/org/categories/", params))) as AssetCategory[];
}

export async function createCategory(input: CategoryInput): Promise<AssetCategory> {
  return (await sendJSON("/api/org/categories/", "POST", input)) as AssetCategory;
}

export async function updateCategory(
  id: number,
  input: Partial<CategoryInput>,
): Promise<AssetCategory> {
  return (await sendJSON(`/api/org/categories/${id}/`, "PATCH", input)) as AssetCategory;
}

export async function deactivateCategory(id: number): Promise<void> {
  await sendJSON(`/api/org/categories/${id}/`, "DELETE");
}

// ── Employees ────────────────────────────────────────────────────────────

export async function listEmployees(params?: {
  search?: string;
  role?: EmployeeRole;
  department?: string;
  status?: OrgStatus;
}): Promise<Employee[]> {
  return (await getJSON(withQuery("/api/org/employees/", params))) as Employee[];
}

export async function updateEmployeeRole(
  id: number,
  role: EmployeeRole,
): Promise<Employee> {
  return (await sendJSON(`/api/org/employees/${id}/role/`, "PATCH", { role })) as Employee;
}

export async function updateEmployeeStatus(
  id: number,
  status: OrgStatus,
): Promise<Employee> {
  return (await sendJSON(`/api/org/employees/${id}/status/`, "PATCH", { status })) as Employee;
}

export async function updateEmployeeDepartment(
  id: number,
  department: number | null,
): Promise<Employee> {
  return (await sendJSON(`/api/org/employees/${id}/department/`, "PATCH", {
    department,
  })) as Employee;
}
