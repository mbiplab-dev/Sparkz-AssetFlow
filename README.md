# AssetFlow

Enterprise Asset & Resource Management System. Backend: Django + DRF + PostgreSQL. Frontend: Next.js (App Router). Everything is driven by a `Makefile` — you rarely need to run raw commands.

## Prerequisites

- [`uv`](https://docs.astral.sh/uv/) — Python package manager (installs backend deps + Python 3.11)
- `node` >= 20 and `npm`
- `docker` + `docker compose` — for Postgres

## Quick start

```bash
# 1. Install backend and frontend dependencies
make install

# 2. Start Postgres, wait for the DB, run migrations, seed admin
make init-db

# 3. Run backend (:8000) and frontend (:3000) side by side
make run
```

That's it. Backend at http://localhost:8000, frontend at http://localhost:3000, API docs at http://localhost:8000/api/docs/.

The first `make init-db` seeds an admin account using values from `backend/.env` (copy `.env.example` to `.env`):

| Variable         | Default                 |
| ---------------- | ----------------------- |
| `ADMIN_EMAIL`    | `admin@assetflow.local` |
| `ADMIN_PASSWORD` | `Admin@12345`           |
| `ADMIN_NAME`     | `Administrator`         |

Everyone else who signs up through the UI is created as `role="employee"`. Only the admin can promote users via the organization APIs.

## Make targets

| Target              | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `make help`         | List available targets                                           |
| `make install`      | Install backend (`uv sync`) and frontend (`npm install`)         |
| `make db`           | Start Postgres container                                         |
| `make db-down`      | Stop the containers                                              |
| `make db-logs`      | Tail Postgres logs                                               |
| `make migrate`      | Apply Django migrations                                          |
| `make init-db`      | `db` + wait for health + `migrate` (seeds admin on first run)    |
| `make run`          | Run backend and frontend concurrently                            |
| `make run-backend`  | Django dev server on `:8000`                                     |
| `make run-frontend` | Next.js dev server on `:3000`                                    |
| `make docs`         | Serve the API with Swagger UI at `/api/docs/`                    |
| `make schema`       | Dump the OpenAPI schema to `backend/schema.yml`                  |
| `make format`       | Run ruff + prettier                                              |
| `make lint`         | Lint backend and frontend                                        |
| `make clean`        | Remove caches and build artifacts                                |

## API surface

All endpoints are documented in Swagger at http://localhost:8000/api/docs/ and grouped by tag:

### Authentication (`/api/auth/`)

- OTP-gated signup: `POST register/request-otp/` → `POST register/verify-otp/`
- Password + OTP login: `POST login/`, `POST login/request-otp/` → `POST login/verify-otp/`
- Password reset: `POST password-reset/request-otp/` → `POST password-reset/confirm/`
- Session: `POST refresh/`, `POST logout/`, `GET me/`

Signup accepts only `full_name`, `email`, `password`. Role is never selectable — new accounts default to `employee`.

### Organization setup (`/api/org/`, admin-only)

| Screen 3 Tab | Endpoint | Actions |
| --- | --- | --- |
| A — Departments | `/api/org/departments/` | full CRUD; `DELETE` soft-deactivates |
| B — Categories  | `/api/org/categories/`  | full CRUD; `DELETE` soft-deactivates |
| C — Employees   | `/api/org/employees/`   | `GET` list/detail |
|                 | `/api/org/employees/{id}/role/`       | `PATCH` — the only place role is assigned |
|                 | `/api/org/employees/{id}/status/`     | `PATCH` — activate / deactivate |
|                 | `/api/org/employees/{id}/department/` | `PATCH` — set department |

List endpoints accept `?search=`, `?status=`, and (for employees) `?role=` / `?department=`.

## Layout

```
backend/
  apps/
    authentication/   # User model, JWT + OTP flows
    organization/     # Department, AssetCategory, employee role management
  config/             # settings, urls
frontend/
  app/                # Next.js App Router
docker-compose.yml    # postgres
Makefile              # everything above
```
