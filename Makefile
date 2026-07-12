.PHONY: help init install install-backend install-frontend ensure-env ensure-tools \
        db db-down db-logs wait-db init-db migrate seed-dev \
        run run-backend run-frontend stop \
        format format-backend format-frontend \
        lint lint-backend lint-frontend \
        test test-backend check docs schema tunnel clean

# ---- config ----------------------------------------------------------------
BACKEND_DIR  := backend
FRONTEND_DIR := frontend
POSTGRES_USER := app
POSTGRES_DB   := app
DB_URL       := postgres://app:app@localhost:5432/app
BACKEND_PORT  := 8000
FRONTEND_PORT := 3000

# Prefer backend/.venv/bin/python when present; fall back to uv run.
PY := $(shell if [ -x $(BACKEND_DIR)/.venv/bin/python ]; then \
	echo $(BACKEND_DIR)/.venv/bin/python; else echo uv run python; fi)

# ---- help ------------------------------------------------------------------
help:
	@echo "AssetFlow — developer commands"
	@echo ""
	@echo "  Setup"
	@echo "    init              Full first-time setup (tools, deps, DB, migrate, seed)"
	@echo "    install           Install backend (uv) + frontend (npm) deps"
	@echo "    ensure-env        Create backend/.env from .env.example if missing"
	@echo ""
	@echo "  Database"
	@echo "    db                Start Postgres (docker compose)"
	@echo "    db-down           Stop docker services"
	@echo "    db-logs           Tail Postgres logs"
	@echo "    wait-db           Block until Postgres accepts connections"
	@echo "    migrate           Run Django migrations"
	@echo "    seed-dev          Seed demo org / assets / holdings / audits"
	@echo "    init-db           db + wait + migrate + seed"
	@echo ""
	@echo "  Run"
	@echo "    run               Backend (:$(BACKEND_PORT)) + frontend (:$(FRONTEND_PORT))"
	@echo "    run-backend       Django only"
	@echo "    run-frontend      Next.js only"
	@echo "    tunnel            Cloudflare quick tunnel → local frontend (optional)"
	@echo "    docs              Print API doc URLs (start backend with run-backend)"
	@echo "    schema            Dump OpenAPI → backend/schema.yml"
	@echo ""
	@echo "  Quality"
	@echo "    format            Format backend (ruff) + frontend (prettier)"
	@echo "    lint              Lint backend + frontend"
	@echo "    test              Backend unit/API tests"
	@echo "    check             Django system check + frontend tsc"
	@echo "    clean             Caches, .next, pyc, schema dump"
	@echo ""
	@echo "Typical first run:"
	@echo "  make init && make run"

# ---- prerequisites ---------------------------------------------------------
ensure-tools:
	@command -v uv >/dev/null 2>&1 || { \
		echo "ERROR: uv is required. Install: https://docs.astral.sh/uv/"; exit 1; }
	@command -v node >/dev/null 2>&1 || { \
		echo "ERROR: node is required (v20+)."; exit 1; }
	@command -v npm >/dev/null 2>&1 || { \
		echo "ERROR: npm is required."; exit 1; }
	@command -v docker >/dev/null 2>&1 || { \
		echo "ERROR: docker is required for Postgres."; exit 1; }
	@docker compose version >/dev/null 2>&1 || { \
		echo "ERROR: docker compose plugin is required."; exit 1; }
	@echo "Tools OK: uv, node, npm, docker compose"

ensure-env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env from .env.example"; \
	else \
		echo "$(BACKEND_DIR)/.env already present"; \
	fi
	@mkdir -p $(BACKEND_DIR)/logs

# ---- one-shot setup --------------------------------------------------------
# Full bootstrap: tools → env → deps → postgres → migrate → seed.
init: ensure-tools ensure-env install
	@echo ""
	@echo "==> Starting Postgres..."
	@$(MAKE) db
	@echo ""
	@$(MAKE) wait-db
	@echo ""
	@echo "==> Running migrations..."
	@cd $(BACKEND_DIR) && uv run python manage.py migrate --noinput
	@echo ""
	@echo "==> Seeding demo data..."
	@cd $(BACKEND_DIR) && uv run python manage.py seed_dev
	@mkdir -p $(BACKEND_DIR)/logs
	@echo ""
	@echo "============================================================"
	@echo "  AssetFlow setup complete."
	@echo ""
	@echo "  Database:   $(DB_URL)"
	@echo "  Backend:    http://localhost:$(BACKEND_PORT)"
	@echo "  Frontend:   http://localhost:$(FRONTEND_PORT)"
	@echo "  API docs:   http://localhost:$(BACKEND_PORT)/api/docs/"
	@echo ""
	@echo "  Demo logins (password for all: Demo@12345)"
	@echo "    admin@assetflow.local          (or Admin@12345 from .env)"
	@echo "    manager.eng@assetflow.local    asset_manager"
	@echo "    employee1@assetflow.local      employee"
	@echo "    head.*@assetflow.local         department_head"
	@echo ""
	@echo "  Next:  make run"
	@echo "============================================================"

# ---- install ---------------------------------------------------------------
install: install-backend install-frontend

install-backend:
	@echo "==> Backend deps (uv sync)..."
	cd $(BACKEND_DIR) && uv sync

install-frontend:
	@echo "==> Frontend deps (npm install)..."
	cd $(FRONTEND_DIR) && npm install

# ---- run -------------------------------------------------------------------
run:
	@echo "Starting backend (:$(BACKEND_PORT)) and frontend (:$(FRONTEND_PORT))..."
	@echo "Press Ctrl+C to stop both."
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) run-backend & \
	$(MAKE) run-frontend & \
	wait

run-backend: ensure-env
	cd $(BACKEND_DIR) && uv run python manage.py runserver 0.0.0.0:$(BACKEND_PORT)

run-frontend:
	cd $(FRONTEND_DIR) && npm run dev -- --port $(FRONTEND_PORT)

# Soft stop helpers for local processes bound to our ports (dev only).
stop:
	@-fuser -k $(BACKEND_PORT)/tcp 2>/dev/null || true
	@-fuser -k $(FRONTEND_PORT)/tcp 2>/dev/null || true
	@echo "Stopped processes on :$(BACKEND_PORT) and :$(FRONTEND_PORT) (if any)."

# ---- db --------------------------------------------------------------------
db:
	docker compose up -d db
	@echo "Postgres container started. DATABASE_URL=$(DB_URL)"

db-down:
	docker compose down

db-logs:
	docker compose logs -f db

wait-db:
	@echo "Waiting for Postgres to be healthy..."
	@i=0; \
	until docker compose exec -T db pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do \
		i=$$((i+1)); \
		if [ $$i -gt 60 ]; then echo "ERROR: Postgres not ready after 60s"; exit 1; fi; \
		sleep 1; \
	done
	@echo "Postgres is ready."

# ---- migrate / seed --------------------------------------------------------
migrate: ensure-env
	cd $(BACKEND_DIR) && uv run python manage.py migrate --noinput

seed-dev: ensure-env
	cd $(BACKEND_DIR) && uv run python manage.py seed_dev

init-db: db wait-db migrate seed-dev
	@echo "init-db complete."

# ---- format ----------------------------------------------------------------
format: format-backend format-frontend

format-backend:
	cd $(BACKEND_DIR) && uv run ruff check --fix . && uv run ruff format .

format-frontend:
	cd $(FRONTEND_DIR) && npm run format

# ---- lint / check / test ---------------------------------------------------
lint: lint-backend lint-frontend

lint-backend:
	cd $(BACKEND_DIR) && uv run ruff check . && uv run ruff format --check .

lint-frontend:
	cd $(FRONTEND_DIR) && npm run lint && npm run format:check

test: test-backend

test-backend: ensure-env
	cd $(BACKEND_DIR) && uv run python manage.py test -v 1

check: ensure-env
	cd $(BACKEND_DIR) && uv run python manage.py check
	cd $(FRONTEND_DIR) && npx tsc --noEmit --pretty false

# ---- docs ------------------------------------------------------------------
docs:
	@echo "Start the backend first: make run-backend"
	@echo "  Swagger UI:  http://localhost:$(BACKEND_PORT)/api/docs/"
	@echo "  ReDoc:       http://localhost:$(BACKEND_PORT)/api/redoc/"
	@echo "  Raw schema:  http://localhost:$(BACKEND_PORT)/api/schema/"

schema: ensure-env
	@echo "==> Generating OpenAPI schema..."
	cd $(BACKEND_DIR) && uv run python manage.py spectacular --file schema.yml --validate
	@echo "Wrote $(BACKEND_DIR)/schema.yml"
	@echo "Browse: http://localhost:$(BACKEND_PORT)/api/docs/  (after make run-backend)"

# ---- tunnel (optional external access) -------------------------------------
tunnel:
	@command -v cloudflared >/dev/null 2>&1 || { \
		echo "cloudflared not found. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"; \
		exit 1; }
	@echo "Tunneling http://localhost:$(FRONTEND_PORT) (start make run first)..."
	cloudflared tunnel --url http://localhost:$(FRONTEND_PORT)

# ---- clean -----------------------------------------------------------------
clean:
	@find $(BACKEND_DIR) -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	@find $(BACKEND_DIR) -type d -name .pytest_cache -prune -exec rm -rf {} + 2>/dev/null || true
	@find $(BACKEND_DIR) -type d -name .ruff_cache -prune -exec rm -rf {} + 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out $(FRONTEND_DIR)/tsconfig.tsbuildinfo
	@rm -f $(BACKEND_DIR)/schema.yml
	@echo "Cleaned Python caches, Next.js build, and schema dump."
