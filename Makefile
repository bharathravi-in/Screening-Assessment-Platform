.PHONY: up up-build down down-volumes restart logs migrate migrate-create seed build-sandboxes clean ps db-shell dev reset

COMPOSE = sudo docker compose

# Start all services
up:
	$(COMPOSE) up -d

# Start with forced rebuild
up-build:
	$(COMPOSE) up -d --build

# Stop all services
down:
	$(COMPOSE) down

# Stop and remove volumes (⚠️ destroys database)
down-volumes:
	$(COMPOSE) down -v

# Restart a specific service: make restart svc=backend
restart:
	$(COMPOSE) restart $(svc)

# Show running containers
ps:
	$(COMPOSE) ps

# Tail logs: make logs svc=backend
logs:
	$(COMPOSE) logs -f $(svc)

# Run Alembic migrations inside backend container
migrate:
	$(COMPOSE) exec backend alembic upgrade head

# Create a new migration: make migrate-create msg="add_something"
migrate-create:
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(msg)"

# Seed initial data
seed:
	$(COMPOSE) exec backend python -m app.db.seed

# Build sandbox Docker images (run from project root)
build-sandboxes:
	sudo docker build -t sandbox-python backend/sandbox_images/python/
	sudo docker build -t sandbox-javascript backend/sandbox_images/javascript/
	sudo docker build -t sandbox-java backend/sandbox_images/java/

# Open psql shell
db-shell:
	$(COMPOSE) exec db psql -U poc_user -d assessments_db

# Run in foreground (shows all logs)
dev:
	$(COMPOSE) up

# Reset everything: stop, destroy volumes, rebuild, start, migrate
reset: down-volumes build-sandboxes
	$(COMPOSE) up -d --build
	@echo "Waiting for db..."
	@sleep 8
	$(MAKE) migrate

# Cleanup
clean:
	$(COMPOSE) down
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
