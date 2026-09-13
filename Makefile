.PHONY: check test backend-check backend-test image compose-config compose-config-external up down logs

IMAGE ?= chihiro:dev
COMPOSE ?= docker compose
ENV_FILE ?= deploy/.env
COMPOSE_FILE ?= deploy/docker-compose.yml

check:
	npm run check:layout
	npm run backend:check
	git diff --check

test:
	node --test apps/gateway/test/*.mjs
	npm run backend:test

backend-check:
	npm run backend:check

backend-test:
	npm run backend:test

image:
	docker build --file Dockerfile --tag $(IMAGE) .

compose-config:
	$(COMPOSE) --env-file deploy/.env.example --file $(COMPOSE_FILE) config --quiet

compose-config-external:
	$(COMPOSE) --env-file deploy/.env.example --file deploy/docker-compose.yml --file deploy/docker-compose.external-napcat.yml config --quiet

up:
	$(COMPOSE) --env-file $(ENV_FILE) --file $(COMPOSE_FILE) up -d

down:
	$(COMPOSE) --env-file $(ENV_FILE) --file $(COMPOSE_FILE) down

logs:
	$(COMPOSE) --env-file $(ENV_FILE) --file $(COMPOSE_FILE) logs -f
