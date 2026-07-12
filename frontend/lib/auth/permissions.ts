import { useAuth } from "@/context/AuthContext";
import type { AuthUser, UserRole } from "./authApi";

/**
 * Every gated action in the UI. Add a new entry here whenever you introduce a
 * new capability, then extend `ROLE_CAPS` below. Keeping the union tight lets
 * TypeScript catch typos at call sites (`can(user, "assets.regsiter")` fails).
 */
export type Capability =
  // Organization / people
  | "org.manage"
  // Assets
  | "assets.register"
  | "assets.edit"
  | "assets.delete"
  // Allocation / transfer / return
  | "assets.allocate"
  | "transfers.approve"
  | "transfers.initiate"
  | "returns.approve"
  | "returns.initiate"
  // Bookings
  | "bookings.create"
  // Maintenance
  | "maintenance.raise"
  | "maintenance.approve"
  // Audit
  | "audit.manage"
  // Reports
  | "reports.view";

/**
 * Role → capabilities. Keep this compact and role-scoped; do NOT try to
 * express department-scoping here (that's a backend concern, and the UI just
 * shows/hides the affordance — the server enforces "own dept only").
 */
const ROLE_CAPS: Record<UserRole, ReadonlySet<Capability>> = {
  admin: new Set<Capability>([
    "org.manage",
    "assets.register",
    "assets.edit",
    "assets.delete",
    "assets.allocate",
    "transfers.approve",
    "transfers.initiate",
    "returns.approve",
    "returns.initiate",
    "bookings.create",
    "maintenance.raise",
    "maintenance.approve",
    "audit.manage",
    "reports.view",
  ]),
  asset_manager: new Set<Capability>([
    "assets.register",
    "assets.edit",
    "assets.allocate",
    "transfers.approve",
    "transfers.initiate",
    "returns.approve",
    "returns.initiate",
    "bookings.create",
    "maintenance.raise",
    "maintenance.approve",
    "reports.view",
  ]),
  department_head: new Set<Capability>([
    // Dept-scoped approvals — the server enforces "only within my department".
    "transfers.approve",
    "transfers.initiate",
    "returns.approve",
    "returns.initiate",
    "bookings.create",
    "maintenance.raise",
    "reports.view",
  ]),
  employee: new Set<Capability>([
    "transfers.initiate",
    "returns.initiate",
    "bookings.create",
    "maintenance.raise",
  ]),
};

/**
 * Falsy user → false (unauthenticated visitors have no capabilities).
 * Keeping this outside React so it can be used from event handlers, guards,
 * loaders, etc. — anywhere you already have the AuthUser in scope.
 */
export function can(user: AuthUser | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  return ROLE_CAPS[user.role]?.has(capability) ?? false;
}

/** Convenience hook that pulls the current user from AuthContext. */
export function useCan(capability: Capability): boolean {
  const { user } = useAuth();
  return can(user, capability);
}
