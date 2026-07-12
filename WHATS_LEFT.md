# AssetFlow — What's Left

Snapshot: 2026-07-12. Everything below is against the spec in `db-schema.txt` / the product brief.

## Done ✅

| Area | Backend | Frontend |
| --- | --- | --- |
| **Auth** | Custom User (email + role + status + phone + department), direct register, OTP signup/login, password reset, JWT + refresh cookie, admin auto-seeded | Login (with **Continue as demo admin** button), signup, forgot-password, OTP login |
| **Organization Setup (Admin)** | Departments / Categories / Employees CRUD (`/api/org/`) — DELETE = soft-deactivate | 3-tab UI with Actions dropdown + Edit dialog on every table |
| **Assets** | `/api/assets/{assets,locations}/` — full CRUD, tag auto-gen, is_bookable flag | Directory table with Actions + Edit dialog |
| **Allocation & Transfer** | `apps.resource_allocation` — holdings / transfers / requests / allocate / return, admin+asset_manager auth path | Holdings table, allocate dialog, transfer/return actions |
| **Booking** | `/api/booking/bookings/` — GiST `EXCLUDE` no-overlap constraint (btree_gist ext.) | Weekly calendar (resource list left, 7×hourly grid right, click-to-book, cancel dialog) |
| **Maintenance** | `/api/maintenance/requests/` — approval workflow with asset-status auto-flip | Kanban board (5 columns), KPI strip, filters, Raise/Diagnose/Reject/Resolve dialogs |
| **Dashboard** | `/api/dashboard/summary/` | KPI cards + activity strip |
| **Reports** | `/api/dashboard/reports/` — aggregations across all tables | 6 cards with bar strips + hourly booking heatmap (⚠ needs varied chart types — see below) |
| **Notifications** | `/api/dashboard/notifications/` — merged feed from maintenance / booking / allocation | Filterable card feed with unread pill |
| **RBAC** | Backend perm classes accept admin in every resource module | `lib/auth/permissions.ts` — `Capability` union, `can()` / `useCan()`, sidebar & page gates |
| **Seed** | `manage.py seed_dev` — 7 depts, 6 categories, 5 locations, 27 users, 40 assets, 8 resource_allocation catalog items with holdings + transfers, 4 maintenance requests, 9 bookings | — |
| **DX** | `make init-db`, `make seed-dev`, `make run`, Swagger at `/api/docs/` | Turbopack dev on :3000, `npm run lint` |

## In flight 🔄

- **Export API** — CSV endpoints for departments/categories/employees/assets/holdings/bookings/maintenance + UI download buttons. Agent still running.
- **Reports v2** — replace bar strips with donut/pie for status, vertical bars for counts, area chart for hourly heatmap. Add Export CSV / PDF from the Reports page itself.
- **Activity Logs** — persistent audit trail: `ActivityLog` model, signals on user-role change / allocation / booking / maintenance transitions, mirror-write to `backend/logs/activity.log`, `/api/activity/` endpoint, activity page in UI.

## Not started ❌

### Audit module (Screen 8)
- **Backend**: `apps.audit` — `AuditCycle` (scope: dept/location, date range, status), `AuditCycleAuditor` (M2M), `AuditItem` (per-asset verdict: Verified/Missing/Damaged), `AuditDiscrepancy` auto-populated on flagged items. Close-cycle transaction that flips missing → asset.status='lost' and damaged → asset.condition='damaged'.
- **Frontend**: `/audit` page — cycle list, create/close cycle dialog, auditor assignment, per-item verdict grid, discrepancy report.

### Follow-ups that would tighten the product

- **Allocation model gap**: `resource_allocation.Holding` is a plain quantity ledger — no `expected_return_at` / `returned_at`. The spec calls for expected-return-date + overdue-return flagging. Either extend Holding, or move to the physical-asset allocation flow that the spec actually describes (one asset = one holder). The notifications feed currently skips the "overdue return" event source because of this.
- **Transfer workflow** (`Requested → Approved → Re-allocated`) — endpoints exist, UI has "Initiate Transfer" but no approvals inbox yet.
- **Maintenance photo attachment** — spec mentions attaching a photo when raising; UI doesn't have a file input yet.
- **Reminder notifications** — spec calls for a reminder before a booking slot starts. Neither a scheduled task nor a notification insertion is in place.
- **Category-specific custom fields** — `AssetCategory.custom_fields_schema` (JSONB) is defined; Asset registration form doesn't currently render fields from that schema.
- **Reports export as PDF** — reserved for Reports v2 agent.
- **Frontend `authApi.ts` still exports both direct `register` and OTP signup helpers** — signup page uses direct `register`; OTP-signup verify view is unused. Prune if we're locked into direct signup.
- **`.next/types/validator.ts` stale errors** — Next 16 caches type-refs to an old `src/app/*` layout. Harmless but noisy. Delete `.next/` on clean builds.

## Test coverage

- **Backend**: `apps.resource_allocation.tests` has thorough model / service / API tests (from an upstream PR). Every other app has empty `tests.py`. If we ship, the priority order for new tests is: booking overlap constraint, maintenance approval workflow, org role-promotion permissions, RBAC gates on the assets endpoint.
- **Frontend**: no tests. `npm run lint` is the only automated gate.

## Deployment notes

- Postgres 16 required (btree_gist / range types).
- `EMAIL_HOST_USER` + `GOOGLE_SMTP_PASSWORD` in `backend/.env` — currently a real dev account. Rotate before deploy.
- `SECRET_KEY` in `.env.example` is a placeholder — regenerate for prod.
- `DEBUG=True` on the dev env; docker-compose Postgres is the only external dep after the Redis removal.
