import { useAuth } from "@/context/AuthContext";
import type { AuthUser, UserRole } from "./authApi";

/**
 * Every gated action in the UI. Add a new entry here whenever you introduce a
 * new capability, then extend `ROLE_CAPS` below.
 */
export type Capability =
  // Organization / people
  | "org.manage"
  // Assets
  | "assets.register"
  | "assets.edit"
  | "assets.delete"
  | "assets.view"
  // Allocation / transfer / return
  | "assets.allocate"
  | "transfers.approve"
  | "transfers.initiate"
  | "returns.approve"
  | "returns.initiate"
  // Bookings
  | "bookings.create"
  | "bookings.view"
  // Maintenance
  | "maintenance.raise"
  | "maintenance.approve"
  | "maintenance.view"
  // Audit
  | "audit.manage"
  | "audit.view"
  // Reports / exports / activity
  | "reports.view"
  | "exports.download"
  | "activity.view"
  | "activity.view_all";

/**
 * Role → capabilities. Department-scoping is enforced server-side; UI only
 * shows/hides affordances based on role.
 *
 * | Capability          | Admin | Asset Mgr | Dept Head | Employee |
 * |---------------------|:-----:|:---------:|:---------:|:--------:|
 * | org.manage          |  ✓    |           |           |          |
 * | assets.register/edit|  ✓    |     ✓     |           |          |
 * | assets.delete       |  ✓    |           |           |          |
 * | assets.allocate     |  ✓    |     ✓     |           |          |
 * | transfers.approve   |  ✓    |     ✓     |     ✓     |          |
 * | transfers.initiate  |  ✓    |     ✓     |     ✓     |    ✓     |
 * | bookings.*          |  ✓    |     ✓     |     ✓     |    ✓     |
 * | maintenance.raise   |  ✓    |     ✓     |     ✓     |    ✓     |
 * | maintenance.approve |  ✓    |     ✓     |           |          |
 * | audit.manage        |  ✓    |     ✓     |           |          |
 * | reports.view        |  ✓    |     ✓     |     ✓     |          |
 * | exports.download    |  ✓    |     ✓     |     ✓     |          |
 * | activity.view_all   |  ✓    |     ✓     |     ✓     |          |
 * | activity.view       |  ✓    |     ✓     |     ✓     |    ✓     |
 */
const ROLE_CAPS: Record<UserRole, ReadonlySet<Capability>> = {
  admin: new Set<Capability>([
    "org.manage",
    "assets.register",
    "assets.edit",
    "assets.delete",
    "assets.view",
    "assets.allocate",
    "transfers.approve",
    "transfers.initiate",
    "returns.approve",
    "returns.initiate",
    "bookings.create",
    "bookings.view",
    "maintenance.raise",
    "maintenance.approve",
    "maintenance.view",
    "audit.manage",
    "audit.view",
    "reports.view",
    "exports.download",
    "activity.view",
    "activity.view_all",
  ]),
  asset_manager: new Set<Capability>([
    "assets.register",
    "assets.edit",
    "assets.view",
    "assets.allocate",
    "transfers.approve",
    "transfers.initiate",
    "returns.approve",
    "returns.initiate",
    "bookings.create",
    "bookings.view",
    "maintenance.raise",
    "maintenance.approve",
    "maintenance.view",
    "audit.manage",
    "audit.view",
    "reports.view",
    "exports.download",
    "activity.view",
    "activity.view_all",
  ]),
  department_head: new Set<Capability>([
    "assets.view",
    "transfers.approve",
    "transfers.initiate",
    "returns.approve",
    "returns.initiate",
    "bookings.create",
    "bookings.view",
    "maintenance.raise",
    "maintenance.view",
    "reports.view",
    "exports.download",
    "activity.view",
    "activity.view_all",
  ]),
  employee: new Set<Capability>([
    "assets.view",
    "transfers.initiate",
    "returns.initiate",
    "bookings.create",
    "bookings.view",
    "maintenance.raise",
    "maintenance.view",
    "activity.view",
  ]),
};

export function can(user: AuthUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  return ROLE_CAPS[user.role]?.has(capability) ?? false;
}

export function useCan(capability: Capability): boolean {
  const { user } = useAuth();
  return can(user, capability);
}

/** True if the user has at least one of the listed capabilities. */
export function canAny(
  user: AuthUser | null | undefined,
  capabilities: Capability[],
): boolean {
  return capabilities.some((c) => can(user, c));
}

export function useCanAny(capabilities: Capability[]): boolean {
  const { user } = useAuth();
  return canAny(user, capabilities);
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: "Admin",
    asset_manager: "Asset Manager",
    department_head: "Department Head",
    employee: "Employee",
  };
  return labels[role] ?? role;
}
