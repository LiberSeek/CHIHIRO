.PHONY: check test backend-check backend-test image manifest-check compose-config compose-config-external backup restore up down logs

IMAGE ?= chihiro:dev
COMPOSE ?= docker compose
ENV_FILE ?= deploy/.env
COMPOSE_FILE ?= deploy/docker-compose.yml

check:
	npm run check:layout
	npm run backend:check
	git diff --check

test:
	npm run backend:test

backend-check:
	npm run backend:check

backend-test:
	npm run backend:test

image:
	docker build --file Dockerfile --tag $(IMAGE) .

manifest-check:
	node deploy/scripts/verify-manifest.mjs

compose-config:
	$(COMPOSE) --env-file deploy/.env.example --file $(COMPOSE_FILE) config --quiet

compose-config-external:
	$(COMPOSE) --env-file deploy/.env.example --file deploy/docker-compose.yml --file deploy/docker-compose.external-napcat.yml config --quiet

backup:
	@test -n "$(BACKUP)" || (echo "BACKUP path is required" >&2; exit 64)
	deploy/scripts/backup.sh "$(BACKUP)"

restore:
	@test -n "$(BACKUP)" || (echo "BACKUP path is required" >&2; exit 64)
	CHIHIRO_RESTORE_CONFIRM=restore deploy/scripts/restore.sh "$(BACKUP)"

up:
	$(COMPOSE) --env-file $(ENV_FILE) --file $(COMPOSE_FILE) up -d

down:
	$(COMPOSE) --env-file $(ENV_FILE) --file $(COMPOSE_FILE) down

logs:
	$(COMPOSE) --env-file $(ENV_FILE) --file $(COMPOSE_FILE) logs -f
