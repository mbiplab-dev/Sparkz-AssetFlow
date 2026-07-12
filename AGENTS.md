# AGENTS.md — Sparkz AssetFlow

Agent-facing project guide for the Enterprise Asset & Resource Management System.
Read this before changing architecture, roles, workflows, or module boundaries.

---

## What this product is

**AssetFlow** is a multi-industry ERP-style platform for tracking, allocating, and maintaining **physical assets** and **shared resources** (equipment, furniture, vehicles, rooms, etc.).

It is **not** accounting software. Do **not** add purchasing, invoicing, payroll, or general-ledger features. Acquisition cost exists only for ranking/reports.

### Vision

Digitize asset and resource management so organizations replace spreadsheets and paper logs with:

- Structured asset lifecycles
- Centralized resource booking
- Real-time visibility into **who holds what**, **where it is**, and **condition**

### Mission (hackathon / product)

Ship a user-centric, responsive app with clean modular architecture, realistic role-based workflows (no self-assigned admin), and the operational flows below.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Django 5.2, Django REST Framework, SimpleJWT |
| API docs | drf-spectacular (Swagger `/api/docs/`, ReDoc `/api/redoc/`) |
| DB | PostgreSQL 16 |
| Cache / OTP | Django local-memory cache |
| Package managers | Backend: `uv` · Frontend: `npm` |
| Lint/format | Backend: `ruff` · Frontend: `eslint` + `prettier` |

### Repo layout

```
Sparkz-AssetFlow/
├── AGENTS.md                 # This file
├── Makefile                  # install / run / migrate / lint / docs
├── docker-compose.yml        # postgres
├── db-schema.txt             # Canonical DB design + hard invariants
├── backend/
│   ├── apps/
│   │   ├── authentication/   # Custom User, JWT, OTP signup/login/reset
│   │   └── organization/     # Departments, asset categories, employee directory
│   ├── config/               # settings, urls, wsgi/asgi
│   ├── manage.py
│   └── pyproject.toml
└── frontend/
    ├── app/
    │   ├── (auth)/           # login, signup, OTP, forgot-password
    │   └── dashboard/
    ├── components/
    ├── context/              # AuthContext
    ├── lib/api/              # HTTP client
    └── lib/auth/             # authApi, tokenStorage
```

Canonical schema proposal: **`db-schema.txt`**. Prefer aligning new models with it.

---

## Roles & access control

| Role | Capabilities |
| --- | --- |
| **Admin** | Org setup: departments, asset categories, employee directory. **Only** place roles are assigned/promoted. |
| **Asset Manager** | Register/allocate assets; approve transfers, maintenance, returns/condition check-in; audit discrepancy resolution. |
| **Department Head** | View dept assets; approve allocation/transfer within dept; book shared resources on behalf of department. |
| **Employee** | View own assets; book shared resources; raise maintenance; initiate return/transfer. |

### Critical auth rules

1. **Signup always creates `role=employee`.** No role picker on signup.
2. **Admin promotes** users to Department Head / Asset Manager only via **Employee Directory** (`/api/org/employees/`).
3. Prefer app-level `User.role` checks (e.g. `IsAdmin`), not Django superuser flags alone, for product RBAC.
4. Inactive users (`status=inactive` / `is_active=False`) must not use the product.

Roles (enum): `admin` | `asset_manager` | `department_head` | `employee`

---

## Feature map (screens)

Implement modules so each screen maps cleanly to backend apps and API tags.

| # | Screen | Who | Purpose |
| --- | --- | --- | --- |
| 1 | Login / Signup | All | Email/password + OTP flows; forgot password; session validation |
| 2 | Dashboard / Home | All (role-aware KPIs) | KPI cards, overdue vs upcoming returns, quick actions |
| 3 | Organization Setup | Admin only | Tabs: Departments · Asset Categories · Employee Directory |
| 4 | Asset Registration & Directory | Asset Manager (+ read for others as scoped) | Register, search/filter, lifecycle status, per-asset history |
| 5 | Asset Allocation & Transfer | Manager / Dept Head / Employee (scoped) | Allocate, conflict → transfer, return, overdue flagging |
| 6 | Resource Booking | Employees / Dept Heads | Calendar, overlap validation, cancel/reschedule, reminders |
| 7 | Maintenance Management | Employee raise; Asset Manager approve | Pending → … → Resolved; asset status side-effects |
| 8 | Asset Audit | Manager / auditors | Cycles, verdicts, discrepancy report, close cycle |
| 9 | Reports & Analytics | Managers / heads | Utilization, maintenance, heatmaps, export |
| 10 | Activity Logs & Notifications | All (own notifications; logs by role) | Real-time ops alerts + immutable activity log |

### Dashboard KPIs (required)

- Assets Available, Assets Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns
- **Overdue returns** (past Expected Return Date) highlighted separately from upcoming

### Quick actions

Register Asset · Book Resource · Raise Maintenance Request

---

## Domain model (essentials)

### Asset lifecycle statuses

`available` · `allocated` · `reserved` · `under_maintenance` · `lost` · `retired` · `disposed`

Example transitions (app layer must validate):

| From | To (examples) |
| --- | --- |
| available | allocated, reserved, under_maintenance, lost, retired |
| allocated | available, under_maintenance, lost |
| under_maintenance | available |
| retired | disposed |

### Asset registration fields

Name, Category, **auto-generated Asset Tag** (e.g. `AF-0001`), Serial Number, Acquisition Date, Acquisition Cost (reports only), Condition, Location, photo/documents, **`is_bookable`** (shared resource flag).

Search/filter: tag, serial, QR, category, status, department, location.

Per-asset history: allocation history + maintenance history.

### Allocation & transfer

- Allocate to **employee and/or department**, optional Expected Return Date.
- **Conflict rule:** cannot allocate an asset that already has an active allocation. Surface holder (e.g. “currently held by Priya”) and offer **Transfer Request**.
- Transfer workflow: `requested` → `approved` / `rejected` → `completed` (history updated).
- Return: mark returned, condition check-in notes, Asset Manager approval as required, status → `available`.
- Overdue: `active` allocation with `expected_return_at < now()` and no return → flag for dashboard + notifications.

### Resource booking

- Only assets with `is_bookable=true`.
- Statuses: `upcoming` · `ongoing` · `completed` · `cancelled`.
- **No overlapping** non-cancelled bookings for the same asset. Adjacent slots OK (half-open range: end of A == start of B is allowed).
- Reminder notification before slot starts.

### Maintenance workflow

`pending` → `approved` / `rejected` → `assigned` → `in_progress` → `resolved` (also `cancelled`)

- On **approval**: asset status → `under_maintenance`
- On **resolution**: asset status → `available` (unless other rules apply)
- Priorities: `low` · `medium` · `high` · `critical`

### Audit cycles

1. Create cycle (scope: department / location, date range)
2. Assign one or more auditors
3. Per asset: `verified` / `missing` / `damaged`
4. Auto-generate discrepancy report for non-verified
5. **Close cycle** (transactional): lock cycle; set confirmed-missing assets → `lost`; damaged → condition update
6. Retain audit history per cycle

Cycle status: `draft` · `in_progress` · `closed`

### Notifications (examples)

Asset Assigned · Maintenance Approved/Rejected · Booking Confirmed/Cancelled/Reminder · Transfer Approved · Overdue Return · Audit Discrepancy Flagged

### Activity log

Record **who / what / when** (and before/after JSON where useful) for admin/manager/employee actions. Prefer append-only logs.

---

## Hard invariants (must preserve)

From `db-schema.txt` — enforce in DB and/or service layer; never “trust the UI only.”

1. **One active allocation per asset** — partial unique index on active allocations.
2. **No overlapping bookings** for the same asset — GiST `EXCLUDE` on `tstzrange(starts_at, ends_at, '[)')` for upcoming/ongoing.
3. **Roles only assigned by Admin** — default `employee` at create; only org employee APIs update role.
4. **Lifecycle transitions** validated in application code (enum locks vocabulary).
5. **Overdue detection** is queryable and drives dashboard + notifications.
6. **Audit close** is transactional (status + asset side-effects).

When implementing Django models for bookings/allocations, prefer the same constraints (or equivalent transactional locks + uniqueness) so race conditions cannot double-allocate or double-book.

---

## Backend conventions

### Apps

| App | Responsibility |
| --- | --- |
| `apps.authentication` | Custom `User`, JWT login, OTP signup/login/password-reset, `/api/auth/*` |
| `apps.organization` | Departments, asset categories, employees + role/status/dept updates; `/api/org/*` |
| `apps.resource_allocation` | Quantity-based asset catalog + allocation/request/transfer workflow; `/api/resources/*` |
| *(planned)* assets | Asset catalog, tags, attachments, lifecycle |
| *(planned)* allocations | Allocations, transfers, returns |
| *(planned)* bookings | Shared resource calendar + overlap rules |
| *(planned)* maintenance | Maintenance requests + workflow side-effects |
| *(planned)* audits | Audit cycles, items, discrepancies |
| *(planned)* notifications | In-app notifications |
| *(planned)* activity | Activity log writer/reader |
| *(planned)* reports | Aggregations / exports |

Prefer **one Django app per domain module** rather than one mega-app. Cross-module status updates (e.g. maintenance → asset) go through explicit service functions, not circular model imports.

### API style

- REST under `/api/...`
- JWT access token in `Authorization: Bearer …`
- Refresh token in **httpOnly cookie** (`refresh_token`); rotation + blacklist enabled
- Default permission: authenticated; tighten per view with role permissions
- Document endpoints with **drf-spectacular** tags (see `SPECTACULAR_SETTINGS`)
- Soft-deactivate master data (departments, categories, users) rather than hard-delete when referenced

### Auth endpoints (existing)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/register/request-otp/` | Validates signup payload; emails OTP; **no user yet** |
| POST | `/api/auth/register/verify-otp/` | Creates employee; returns session |
| POST | `/api/auth/login/` | Email + password |
| POST | `/api/auth/login/request-otp/` | Passwordless login OTP |
| POST | `/api/auth/login/verify-otp/` | |
| POST | `/api/auth/password-reset/request-otp/` | |
| POST | `/api/auth/password-reset/confirm/` | |
| POST | `/api/auth/refresh/` | Cookie-based refresh |
| POST | `/api/auth/logout/` | Blacklist refresh |
| GET | `/api/auth/me/` | Current user |

### Org endpoints (existing, Admin-only)

- `/api/org/departments/`
- `/api/org/categories/`
- `/api/org/employees/` (+ role / status / department update actions)

### Settings / env

- `DATABASE_URL` components: `POSTGRES_*`
- `SECRET_KEY`, `DEBUG`, `CORS_ALLOWED_ORIGINS`
- SMTP: `EMAIL_HOST_USER`, `GOOGLE_SMTP_PASSWORD` (or console email backend for local)
- JWT: access ~15m, refresh ~7d

---

## Frontend conventions

- **App Router** under `frontend/app/`
- Auth pages in route group `(auth)/`
- Shared client state: `AuthContext`
- API helpers: `lib/api/http.ts`, `lib/api/client.ts`
- Auth surface: `lib/auth/authApi.ts`, token in memory/local storage for access token only
- Prefer server-friendly patterns where they fit; keep secrets off the client
- Next.js 16 may differ from older training data — check `frontend/node_modules/next/dist/docs/` and `frontend/AGENTS.md` / `CLAUDE.md` before non-obvious Next APIs

### UI expectations

- Responsive, role-aware navigation (hide Admin org setup from non-admins)
- Clear conflict UX (allocation blocked → show holder + Transfer CTA)
- Booking calendar with visible overlaps rejected server-side and surfaced cleanly
- Dashboard separates overdue vs upcoming returns

---

## Typical product flow (happy path)

1. Admin sets up departments, categories; promotes employees to Dept Head / Asset Manager.
2. Asset Manager registers asset → status `available`.
3. Asset is allocated **or** marked bookable.
4. Employees book shared resources by time slot; overlaps rejected.
5. Holder raises maintenance → Asset Manager approves → asset `under_maintenance` → work → resolved → `available`.
6. Transfers/returns as needs change; overdue returns auto-flagged.
7. Audit cycles verify inventory; close applies lost/damaged outcomes.
8. Notifications, activity logs, and reports cover the trail.

---

## Implementation status (as of this file)

### Done / in progress

- [x] Monorepo skeleton, Makefile, docker-compose (Postgres)
- [x] Auth: custom User with roles, OTP signup/login/password reset, JWT + refresh cookie
- [x] Organization: Department, AssetCategory, Employee directory + Admin role promotion
- [x] Frontend auth screens + basic dashboard shell
- [x] Schema design document (`db-schema.txt`)

### Not built yet (priority order for agents)

1. ~~Assets app~~ / ~~Allocations + transfers + returns~~ → done as `apps.resource_allocation`
   (quantity-based catalog + allocate/sub-allocate/request/peer-fulfill/return;
   see `docs/superpowers/specs/2026-07-12-resource-allocation-design.md`).
   Per-unit serialized tracking and overdue-return tracking were NOT built —
   intentional deviation, quantity-only model.
2. Bookings app (Screen 6) — still not built (planned as a separate `booking` app)
3. Bookings + overlap constraints
4. Maintenance workflow + asset status hooks
5. Audit cycles + discrepancy report + close
6. Notifications + activity log writers on domain events
7. Dashboard KPI APIs + richer frontend
8. Reports & export
9. Frontend screens 3–10 wired to APIs with RBAC UI

Keep this checklist honest when completing work.

---

## Commands

From repo root:

```bash
make install          # backend uv sync + frontend npm install
make db               # start postgres
make init-db          # wait for postgres + migrate
make migrate          # Django migrations
make run              # backend :8000 + frontend :3000
make run-backend
make run-frontend
make docs             # API docs on :8000
make schema           # dump OpenAPI → backend/schema.yml
make format
make lint
make clean
```

Default local DB URL: `postgres://app:app@localhost:5432/app`

---

## Agent operating rules

1. **Scope discipline** — Asset & resource management only; no accounting/purchasing/invoicing modules.
2. **RBAC first** — Never allow signup or self-service elevation to admin/manager.
3. **Enforce invariants server-side** — double-allocation and booking overlap must be impossible under concurrency.
4. **Lifecycle side-effects** — maintenance approval/resolution, audit close, return, and transfer completion must update asset status in the same logical transaction.
5. **Align with `db-schema.txt`** — enums, tables, and constraints are the contract; note intentional deviations in PR/commit messages.
6. **Modular apps** — new domains get new Django apps + OpenAPI tags; mirror with frontend routes/modules.
7. **Soft-delete master data** — departments/categories/users: deactivate when referenced.
8. **Notifications + activity log** — domain events should write both where the product requires visibility.
9. **Small, reviewable changes** — prefer vertical slices (model → API → minimal UI) over giant untested dumps.
10. **Verify** — run relevant migrations, linters, and manual/API checks for the flow you touched.

---

## Out of scope

- Purchasing, procurement, vendor invoices
- General ledger, AR/AP, payroll
- Industry-specific compliance packs (unless explicitly requested)
- Self-service role elevation
- Hard-deleting historical allocation/maintenance/audit records that are part of the audit trail

---

## References

- Product requirements: this document (screens, roles, workflows)
- Database contract: `db-schema.txt`
- Frontend Next.js notes: `frontend/AGENTS.md`, `frontend/CLAUDE.md`
- API exploration: `http://localhost:8000/api/docs/` after `make run-backend`
