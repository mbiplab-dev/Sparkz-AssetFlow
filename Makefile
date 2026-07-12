.PHONY: help run run-backend run-frontend db db-down db-logs init-db migrate \
        install install-backend install-frontend \
        format format-backend format-frontend \
        lint lint-backend lint-frontend \
        docs schema clean

# ---- config ----------------------------------------------------------------
BACKEND_DIR := backend
FRONTEND_DIR := frontend
DB_URL := postgres://hackathon:hackathon@localhost:5432/hackathon

# ---- help ------------------------------------------------------------------
help:
	@echo "Targets:"
	@echo "  run              Run backend + frontend concurrently"
	@echo "  run-backend      Run Django dev server (port 8000)"
	@echo "  run-frontend     Run Next.js dev server (port 3000)"
	@echo "  db               Start postgres in docker (prints DATABASE_URL)"
	@echo "  db-down          Stop the postgres container"
	@echo "  db-logs          Tail postgres logs"
	@echo "  init-db          Migrate + seed fake data"
	@echo "  migrate          Run Django migrations"
	@echo "  install          Install backend + frontend dependencies"
	@echo "  format           Format backend + frontend"
	@echo "  lint             Lint backend + frontend"
	@echo "  docs             Serve API docs (Swagger UI at /api/docs/)"
	@echo "  schema           Dump OpenAPI schema to backend/schema.yml"
	@echo "  clean            Remove caches and build artifacts"

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
	cd $(BACKEND_DIR) && uv run python manage.py migrate

init-db: db
	@echo "Waiting for postgres to be healthy..."
	@until docker compose exec -T db pg_isready -U hackathon -d hackathon >/dev/null 2>&1; do sleep 1; done
	cd $(BACKEND_DIR) && uv run python manage.py migrate
	cd $(BACKEND_DIR) && uv run python manage.py seed

# ---- install ---------------------------------------------------------------
install: install-backend install-frontend

install-backend:
	cd $(BACKEND_DIR) && uv sync

install-frontend:
	cd $(FRONTEND_DIR) && npm install

# ---- format ----------------------------------------------------------------
format: format-backend format-frontend

format-backend:
	cd $(BACKEND_DIR) && uv run ruff format . && uv run ruff check --fix .

format-frontend:
	cd $(FRONTEND_DIR) && npm run format

# ---- lint ------------------------------------------------------------------
lint: lint-backend lint-frontend

lint-backend:
	cd $(BACKEND_DIR) && uv run ruff check . && uv run ruff format --check .

lint-frontend:
	cd $(FRONTEND_DIR) && npm run lint && npm run format:check

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
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} +
	rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out
