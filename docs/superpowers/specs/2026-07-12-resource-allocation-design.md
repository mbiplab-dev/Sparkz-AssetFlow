# Resource Allocation — Design Spec

Date: 2026-07-12
Status: Approved (design phase)

## 1. Scope

A new Django app, **`apps.resource_allocation`**, covering:

- The asset catalog (register assets, quantity-tracked)
- Allocation of asset quantity between the Asset Manager's pool, Departments, and Employees
- A request/fulfillment workflow, including peer department-to-department transfers

This is a **deliberate deviation** from the app-per-domain split proposed in `AGENTS.md` (which lists separate `assets` and `allocations` apps). Per explicit user direction, both live in one `resource_allocation` app.

**Explicitly out of scope for this pass** (each a separate future app/spec):

- `booking` app — Screen 6 time-slot booking of shared/bookable resources (calendar, overlap validation). The `Asset.is_bookable` field is added now as a placeholder only.
- Maintenance workflow, audit cycles, notifications, activity log, reports — unchanged from `AGENTS.md`'s existing "not built yet" list.
- Per-unit serialized tracking (`asset_tag`, `serial_number`, per-item condition/lifecycle status as in the base spec's Screen 4/5). This app is **quantity-only** — a deliberate, explicit deviation from the base spec, confirmed with the user.

## 2. Data Model

All models live in `apps.resource_allocation`. FKs to `organization.AssetCategory` / `organization.Department` and `authentication.User` reuse existing master data — no duplication.

### `Asset`

| Field | Notes |
| --- | --- |
| `name` | e.g. "Pens", "Toyota Innova" |
| `category` | FK → `organization.AssetCategory` (admin-managed, unchanged) |
| `total_quantity` | PositiveIntegerField; total ever registered |
| `condition` | free text / choice, describes the batch as a whole |
| `location` | text |
| `is_bookable` | bool, placeholder for future `booking` app |
| `created_by` | FK → User (must be `asset_manager`) |
| `created_at` / `updated_at` | |

On create, a `Holding(holder_type=manager, holder_id=None, quantity=total_quantity)` row is created in the same transaction — the asset starts 100% unallocated.

`total_quantity` is only ever changed by an explicit "adjust stock" action (increase = new stock arriving, decrease = disposal/write-off), never directly by allocation — allocation only moves quantity between `Holding` rows. A decrease can only draw down the **manager pool's** `Holding` (unallocated stock) — it is rejected if the manager pool doesn't have enough unallocated quantity to cover the decrease (already-allocated quantity held by departments/employees can't be silently written off).

### `Holding`

Current-state table: who holds how much of an asset right now.

| Field | Notes |
| --- | --- |
| `asset` | FK → Asset |
| `holder_type` | enum: `manager` \| `department` \| `employee` |
| `holder_id` | nullable (null only when `holder_type=manager`) |
| `quantity` | PositiveIntegerField (>= 0 enforced by DB check constraint) |

Unique together: `(asset, holder_type, holder_id)`.

**Hard invariant:** for every `Asset`, `sum(Holding.quantity) == Asset.total_quantity`. Enforced by construction — every mutation is a paired transfer between exactly two `Holding` rows inside one DB transaction with `select_for_update()` on both rows (or row-level locking equivalent), never a lone increment/decrement. A management check / test asserts this invariant holds across all assets.

A department's "spare" capacity is simply its current `Holding.quantity` — no further subtraction is needed. Sub-allocating to an employee (workflow step 3) already moves quantity out of the department's `Holding` row and into the employee's via `move_quantity`, so the department's `Holding.quantity` at any moment already reflects only what it hasn't pushed further down. (An earlier draft of this doc specified `spare = department's Holding.quantity - sum(employee holdings)`, which double-subtracts already-moved quantity — corrected during implementation of Task 4.)

### `AllocationRequest`

| Field | Notes |
| --- | --- |
| `asset` | FK → Asset |
| `requested_by` | FK → User |
| `for_holder_type` / `for_holder_id` | who the request is for (usually the requester, or their department) |
| `quantity_requested` | PositiveIntegerField |
| `quantity_fulfilled` | running total, starts at 0 |
| `status` | `open` \| `partially_fulfilled` \| `fulfilled` \| `rejected` \| `cancelled` |
| `created_at` / `updated_at` | |

Status transitions: `open → partially_fulfilled → fulfilled` as `Transfer`s accumulate against it; `open/partially_fulfilled → rejected` (Asset Manager, before any fulfillment covers it, or to close out an unfulfillable request); `open/partially_fulfilled → cancelled` (requester withdraws).

### `Transfer`

Immutable ledger — every quantity movement, ever, is one row here.

| Field | Notes |
| --- | --- |
| `asset` | FK → Asset |
| `from_holder_type` / `from_holder_id` | null type-pair = manager pool |
| `to_holder_type` / `to_holder_id` | |
| `quantity` | PositiveIntegerField |
| `request` | FK → AllocationRequest, nullable (null for discretionary pushes / plain returns not tied to a request) |
| `performed_by` | FK → User (who executed this movement) |
| `kind` | `allocate` \| `fulfill_request` \| `peer_transfer` \| `return` — for reporting/filtering only, doesn't change mechanics |
| `notes` | text, optional |
| `created_at` | |

## 3. Roles & Permissions

Reuses `authentication.UserRole`. No new roles.

| Role | Capabilities in this app |
| --- | --- |
| `admin` | None directly (categories remain admin-only via `organization` app, unchanged) |
| `asset_manager` | Register assets, adjust stock, discretionary-push allocate from manager pool to any department/employee, fulfill open requests from manager pool, reject requests |
| `department_head` | View own department's holdings + sub-allocations to their employees; create requests (for self or department); push spare department quantity to sub-allocate to their own employees; fulfill other departments' open broadcast requests from their own spare quantity; return department quantity to manager pool |
| `employee` | View own holdings; create requests for themselves; return their own held quantity |

No approval gate between `asset_manager` and `department_head` — both act directly within their own authority (confirmed design decision, not a bug).

## 4. Core Workflows

1. **Registration** (Asset Manager) — create `Asset` + auto `Holding(manager, total_quantity)`.
2. **Discretionary allocate** (Asset Manager → Department, no approval check) — `Transfer(kind=allocate, from=manager, to=department)`, updates both `Holding` rows atomically.
3. **Sub-allocate within department** (Department Head → their own Employee) — same mechanics, `from=department, to=employee`; Dept Head can only move quantity they currently hold, and only to an employee whose `User.department` matches their own department.
4. **Request → fulfilled from manager pool** — `AllocationRequest` created by Employee/Dept Head; if manager pool covers the remaining amount, Asset Manager fulfills via `Transfer(kind=fulfill_request, from=manager, request=<req>)`.
5. **Request → broadcast peer fulfillment** — if manager pool is insufficient/empty, the request becomes visible to every department currently holding that asset with spare quantity > 0. Any such Dept Head can act (explicit action, not automatic matching) to fulfill all or part of the remainder via `Transfer(kind=peer_transfer, from=department, request=<req>)`. Multiple departments may each contribute; `quantity_fulfilled` accumulates; request auto-closes `fulfilled` once it reaches `quantity_requested`. First-come-first-served — concurrent fulfillment attempts are serialized via row locking so the request can never be over-fulfilled.
6. **Return** — holder returns quantity to the manager pool: `Transfer(kind=return, to=manager)`.

All of 2–6 run inside a single DB transaction: lock the two affected `Holding` rows (`select_for_update`), validate quantities, write both `Holding` updates + the `Transfer` row + any `AllocationRequest` status/quantity update together, or roll back entirely.

## 5. API Surface

Mounted at `/api/resources/` (new include in `config/urls.py`), following the existing `organization` app's `ModelViewSet` + `DefaultRouter` + `@action` convention, `drf-spectacular` tags, and role-based `permissions.py` classes (e.g. `IsAssetManager`, `IsDepartmentHead`, or shared helpers as appropriate).

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET/POST | `/api/resources/assets/` | Auth'd read; Asset Manager write | list/search/filter by category, name; create |
| GET/PATCH | `/api/resources/assets/{id}/` | Asset Manager write | detail, edit |
| POST | `/api/resources/assets/{id}/adjust-stock/` | Asset Manager | change `total_quantity`, adjusts manager `Holding` |
| GET | `/api/resources/holdings/` | Auth'd, scoped | filter by asset/department/employee; a user sees their own + their department's; Asset Manager sees all |
| POST | `/api/resources/allocations/allocate/` | Asset Manager, Dept Head (own dept quantity only) | discretionary push, `from`/`to` + quantity |
| GET/POST | `/api/resources/requests/` | Auth'd | list (scoped) / create a request |
| POST | `/api/resources/requests/{id}/fulfill/` | Asset Manager (from manager pool) or Dept Head (from own dept spare, peer path) | body: quantity to contribute; validates source has enough spare |
| POST | `/api/resources/requests/{id}/reject/` | Asset Manager | |
| POST | `/api/resources/requests/{id}/cancel/` | request owner | |
| POST | `/api/resources/transfers/return/` | holder (dept or employee) | return quantity to manager pool |
| GET | `/api/resources/transfers/` | Auth'd, scoped | read-only ledger view, filter by asset/holder |

## 6. Concurrency & Invariant Enforcement

- DB-level `CHECK (quantity >= 0)` on `Holding`.
- All quantity-moving operations wrapped in `transaction.atomic()` with `select_for_update()` on the involved `Holding` row(s), created via `get_or_create` inside the lock if the destination holding doesn't exist yet.
- Service-layer functions (not views directly) own the "move quantity" logic, mirroring `AGENTS.md`'s existing rule that cross-module status changes go through explicit service functions.
- A test asserts `sum(Holding.quantity) == Asset.total_quantity` holds after concurrent fulfillment attempts (e.g. two Dept Heads racing to fulfill the same request).

## 7. Explicitly Deferred

- `booking` app (Screen 6)
- Maintenance, audits, notifications, activity log, reports (unchanged roadmap items)
- Per-unit serialized asset tracking
- Two-stage (Dept Head then Asset Manager) approval — flat, single-stage by design
