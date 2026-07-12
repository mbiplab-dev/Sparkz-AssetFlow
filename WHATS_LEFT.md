# AssetFlow — What's Left

Snapshot after audits merge + employee UX pass. Product rules: `AGENTS.md`.

## Done

| Area | Notes |
| --- | --- |
| Auth | JWT + refresh cookie, direct register, OTP flows, demo role login |
| Organization | Departments / categories / employees CRUD (admin) |
| Assets | Catalog, locations, lifecycle status |
| Allocation | Holdings, allocate, return; employee-scoped list |
| Booking | Calendar + GiST no-overlap |
| Maintenance | Kanban workflow |
| **Audits** | Real `apps.audits` — cycles, items, verdicts, discrepancies, close side-effects |
| Dashboard / reports / exports / activity / notifications | Wired |
| Seed | `seed_dev` — org, assets, holdings, bookings, maintenance, demo audit for employee1 |
| DX | `make init`, README, Makefile targets |

## Follow-ups (product depth)

- **Expected return dates / overdue** on holdings (schema gap vs quantity ledger)
- **Transfer approval inbox** (capability exists; UI is manager-driven return+reallocate today)
- **Maintenance photo attach**
- **Booking start reminders**
- **Category custom_fields_schema** on register form
- **Reports PDF export**
- Broader backend test coverage beyond `resource_allocation` + `audits`

## DX / deploy

- Postgres 16 required (`btree_gist`)
- Rotate `SECRET_KEY` / admin password before deploy
- `DEBUG=True` is for local only
