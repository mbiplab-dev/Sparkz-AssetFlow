.PHONY: help init install install-backend install-frontend \
        db db-down db-logs init-db migrate seed-dev \
        run run-backend run-frontend \
        format format-backend format-frontend \
        lint lint-backend lint-frontend \
        docs schema check clean

# ---- config ----------------------------------------------------------------
BACKEND_DIR := backend
FRONTEND_DIR := frontend
POSTGRES_USER := app
POSTGRES_DB := app
DB_URL := postgres://app:app@localhost:5432/app

# ---- help ------------------------------------------------------------------
help:
	@echo "AssetFlow make targets"
	@echo ""
	@echo "  init             ONE-SHOT setup: install deps, start DB, migrate, seed"
	@echo "  install          Install backend (uv) + frontend (npm) dependencies"
	@echo "  db               Start Postgres in docker"
	@echo "  db-down          Stop docker services"
	@echo "  db-logs          Tail Postgres logs"
	@echo "  migrate          Run Django migrations"
	@echo "  seed-dev         Seed demo departments/categories/users/assets"
	@echo "  init-db          Wait for Postgres, migrate, seed"
	@echo "  run              Run backend (:8000) + frontend (:3000)"
	@echo "  run-backend      Django dev server only"
	@echo "  run-frontend     Next.js dev server only"
	@echo "  format           Format backend + frontend"
	@echo "  lint             Lint backend + frontend"
	@echo "  check            Django system check + frontend typecheck"
	@echo "  docs             API docs (Swagger at /api/docs/)"
	@echo "  schema           Dump OpenAPI schema → backend/schema.yml"
	@echo "  clean            Remove caches and build artifacts"
	@echo ""
	@echo "Typical first run:"
	@echo "  make init && make run"

# ---- one-shot setup --------------------------------------------------------
# Installs deps, brings up Postgres, waits for health, migrates, seeds demo data.
init: install
	@echo ""
	@echo "==> Starting Postgres..."
	@$(MAKE) db
	@echo ""
	@echo "==> Waiting for Postgres to be healthy..."
	@until docker compose exec -T db pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do \
		sleep 1; \
	done
	@echo "Postgres is ready."
	@echo ""
	@echo "==> Running migrations..."
	@cd $(BACKEND_DIR) && uv run python manage.py migrate --noinput
	@echo ""
	@echo "==> Seeding demo data..."
	@cd $(BACKEND_DIR) && uv run python manage.py seed_dev
	@mkdir -p $(BACKEND_DIR)/logs
	@echo ""
	@echo "============================================================"
	@echo "  Setup complete."
	@echo "  Database:  $(DB_URL)"
	@echo "  Next:      make run"
	@echo "  API docs:  http://localhost:8000/api/docs/"
	@echo "  App:       http://localhost:3000"
	@echo "============================================================"

# ---- install ---------------------------------------------------------------
install: install-backend install-frontend

install-backend:
	cd $(BACKEND_DIR) && uv sync

install-frontend:
	cd $(FRONTEND_DIR) && npm install

# ---- run -------------------------------------------------------------------
run:
	@echo "Starting backend (:8000) and frontend (:3000)..."
	@trap 'kill 0' EXIT; \
	$(MAKE) run-backend & \
	$(MAKE) run-frontend & \
	wait

run-backend:
	cd $(BACKEND_DIR) && uv run python manage.py runserver 0.0.0.0:8000

run-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# ---- db --------------------------------------------------------------------
db:
	docker compose up -d db
	@echo ""
	@echo "Postgres is up. DATABASE_URL=$(DB_URL)"

db-down:
	docker compose down

db-logs:
	docker compose logs -f db

# ---- init / migrate --------------------------------------------------------
migrate:
	cd $(BACKEND_DIR) && uv run python manage.py migrate --noinput

seed-dev:
	cd $(BACKEND_DIR) && uv run python manage.py seed_dev

init-db: db
	@echo "Waiting for postgres to be healthy..."
	@until docker compose exec -T db pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do sleep 1; done
	@$(MAKE) migrate
	@$(MAKE) seed-dev

# ---- format ----------------------------------------------------------------
format: format-backend format-frontend

format-backend:
	cd $(BACKEND_DIR) && uv run ruff check --fix . && uv run ruff format .

format-frontend:
	cd $(FRONTEND_DIR) && npm run format

# ---- lint / check ----------------------------------------------------------
lint: lint-backend lint-frontend

lint-backend:
	cd $(BACKEND_DIR) && uv run ruff check . && uv run ruff format --check .

lint-frontend:
	cd $(FRONTEND_DIR) && npm run lint && npm run format:check

check:
	cd $(BACKEND_DIR) && uv run python manage.py check
	cd $(FRONTEND_DIR) && npx tsc --noEmit

# ---- docs ------------------------------------------------------------------
docs:
	@echo "Swagger UI:  http://localhost:8000/api/docs/"
	@echo "ReDoc:       http://localhost:8000/api/redoc/"
	@echo "Raw schema:  http://localhost:8000/api/schema/"
	cd $(BACKEND_DIR) && uv run python manage.py runserver 0.0.0.0:8000

schema:
	cd $(BACKEND_DIR) && uv run python manage.py spectacular --file schema.yml
	@echo "Wrote backend/schema.yml"

# ---- clean -----------------------------------------------------------------
clean:
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out
