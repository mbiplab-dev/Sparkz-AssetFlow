# AssetFlow

Enterprise **asset & resource management** for physical equipment, vehicles, rooms, and shared resources — allocation, booking, maintenance, audits, and role-based ops. Not accounting software.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Django 5.2, Django REST Framework, SimpleJWT |
| API docs | drf-spectacular — Swagger `/api/docs/`, ReDoc `/api/redoc/` |
| Database | PostgreSQL 16 (Docker) |
| Tooling | `Makefile`, backend `uv`, frontend `npm` |

---

## Prerequisites

| Tool | Version / notes |
| --- | --- |
| [uv](https://docs.astral.sh/uv/) | Installs Python 3.11 + backend deps |
| Node.js | **≥ 20** + npm |
| Docker | Docker Engine + **Compose v2** (Postgres) |
| cloudflared | Optional — only for `make tunnel` |

```bash
# quick checks
uv --version && node -v && npm -v && docker compose version
```

---

## Quick start (one command)

```bash
git clone <repo-url> Sparkz-AssetFlow
cd Sparkz-AssetFlow

make init    # tools check, .env, deps, Postgres, migrate, seed
make run     # backend :8000 + frontend :3000
```

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/api/docs/ |
| ReDoc | http://localhost:8000/api/redoc/ |

### Demo accounts

Seeded by `make init` / `make seed-dev`. **Password for demo staff:** `Demo@12345`

| Email | Role |
| --- | --- |
| `admin@assetflow.local` | Admin (password also from `ADMIN_PASSWORD` in `.env`, default `Admin@12345`) |
| `manager.eng@assetflow.local` | Asset manager |
| `manager.fac@assetflow.local` | Asset manager |
| `employee1@assetflow.local` | Employee (has allocations + sample audit assignment) |
| `head.<dept>@assetflow.local` | Department heads |

The login page has **one-click demo role** buttons for the main four roles.

Signup always creates `role=employee`. Only Admin promotes users via **Organization → Employees**.

---

## Make targets

Run `make help` any time.

### Setup

| Target | What it does |
| --- | --- |
| **`make init`** | Full bootstrap: verify tools → create `.env` → `uv sync` + `npm install` → start Postgres → migrate → `seed_dev` |
| `make install` | Backend + frontend dependencies only |
| `make ensure-env` | Copy `backend/.env.example` → `backend/.env` if missing |

### Database

| Target | What it does |
| --- | --- |
| `make db` | `docker compose up -d db` |
| `make db-down` | Stop compose services |
| `make db-logs` | Tail Postgres logs |
| `make wait-db` | Block until Postgres is healthy |
| `make migrate` | Django migrations |
| `make seed-dev` | Idempotent demo data (depts, users, assets, holdings, bookings, maintenance, audit) |
| `make init-db` | `db` + wait + migrate + seed (deps already installed) |

### Run

| Target | What it does |
| --- | --- |
| **`make run`** | Backend + frontend together (Ctrl+C stops both) |
| `make run-backend` | Django on `0.0.0.0:8000` |
| `make run-frontend` | Next.js on port **3000** |
| `make stop` | Kill processes bound to :8000 / :3000 (dev convenience) |
| `make tunnel` | Cloudflare quick tunnel to the frontend (needs `cloudflared`) |
| `make docs` | Print API documentation URLs |
| `make schema` | Write OpenAPI YAML to `backend/schema.yml` |

### Quality

| Target | What it does |
| --- | --- |
| `make format` | ruff (backend) + prettier (frontend) |
| `make lint` | ruff check + eslint + prettier check |
| `make test` | Django tests (`resource_allocation`, `audits`, …) |
| `make check` | `manage.py check` + `tsc --noEmit` |
| `make clean` | `__pycache__`, `.next`, schema dump |

---

## Environment

### Backend — `backend/.env`

Created automatically by `make init` / `make ensure-env` from `backend/.env.example`:

```env
DEBUG=True
SECRET_KEY=django-insecure-change-me

POSTGRES_DB=app
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,testserver

ADMIN_EMAIL=admin@assetflow.local
ADMIN_PASSWORD=Admin@12345
ADMIN_NAME=Administrator

# Optional SMTP for OTP mail (console backend also fine for local OTP debugging)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

### Frontend — API base URL

By default the Next app **proxies `/api/*` to Django** (`BACKEND_ORIGIN`, default `http://127.0.0.1:8000`) via `next.config.ts` rewrites. You usually **do not** need `NEXT_PUBLIC_API_URL`.

| Mode | Config |
| --- | --- |
| Local / tunnel same-origin | Leave `NEXT_PUBLIC_API_URL` unset (rewrites) |
| Direct browser → Django | `NEXT_PUBLIC_API_URL=http://localhost:8000` |

---

## Architecture (apps)

```
Sparkz-AssetFlow/
├── Makefile                 # all DX commands
├── docker-compose.yml       # Postgres 16
├── backend/
│   ├── apps/
│   │   ├── authentication/  # User, JWT, OTP, register
│   │   ├── organization/    # depts, categories, employees
│   │   ├── assets/          # catalog + locations
│   │   ├── resource_allocation/  # holdings, allocate, return
│   │   ├── booking/         # calendar + GiST no-overlap
│   │   ├── maintenance/     # request workflow
│   │   ├── audits/          # cycles, verdicts, discrepancies
│   │   ├── dashboard/       # KPIs, reports, exports, notifications
│   │   └── activity/        # activity log API
│   ├── config/              # settings, urls
│   ├── manage.py
│   └── pyproject.toml       # uv project
└── frontend/
    ├── app/                 # App Router (auth + app shells)
    ├── components/
    ├── context/AuthContext.tsx
    └── lib/api/             # typed API clients
```

### Roles (RBAC)

| Role | Typical access |
| --- | --- |
| **Admin** | Org setup, full ops |
| **Asset manager** | Register/allocate assets, maintenance approve, audits |
| **Department head** | Dept view, transfers/returns, booking |
| **Employee** | Own holdings, book, raise maintenance, audit when assigned |

UI capabilities live in `frontend/lib/auth/permissions.ts`. Server-side permissions enforce the same boundaries.

---

## Common workflows

```bash
# Fresh machine
make init && make run

# After pulling migrations
make migrate && make seed-dev

# Reset demo data (keeps admin user)
cd backend && uv run python manage.py seed_dev --reset

# API-only while iterating on backend
make run-backend
# → http://localhost:8000/api/docs/

# Share a running app over the internet
make run          # terminal 1
make tunnel       # terminal 2 → public https URL

# Before a PR
make format && make lint && make test && make check
```

### Frontend talks to API

Authenticated calls go through `frontend/lib/api/client.ts` (`authRequest`): JWT in memory + httpOnly refresh cookie, one silent refresh on 401.

---

## Modules (product map)

| Area | Backend | UI |
| --- | --- | --- |
| Auth | `/api/auth/` | `/login`, `/signup`, OTP, forgot password |
| Organization | `/api/org/` | `/organization` (admin) |
| Assets | `/api/assets/` | `/assets` |
| Allocation | `/api/resources/` | `/allocation` |
| Booking | `/api/booking/` | `/booking` |
| Maintenance | `/api/maintenance/` | `/maintenance` |
| Audits | `/api/audits/` | `/audit` |
| Dashboard / reports / export | `/api/dashboard/` | `/dashboard`, `/reports` |
| Activity | `/api/activity/` | `/activity` |
| Notifications | `/api/dashboard/notifications/` | `/notifications` |


---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `connection refused` on DB | `make db && make wait-db` |
| Port 3000 busy | Stop other apps, or `make stop`, or Next will pick 3001 — update CORS if needed |
| Port 8000 busy | `make stop` or free the process |
| 401 on exports / API | Log in again; refresh cookie path must be same-origin or correct CORS |
| OTP email not sending | Set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` and read terminal output |
| Stale Next types | `make clean` then `make run-frontend` |
| Migrations after pull | `make migrate` |
| Empty allocate modal | Seed or register assets; managers sync catalog into resource pool on list |

---

## License / notes

Hackathon / internal ERP prototype. Rotate `SECRET_KEY` and admin passwords before any shared deploy. Postgres volume persists in Docker (`postgres_data`).
