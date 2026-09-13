# syntax=docker/dockerfile:1.7

# P1 compatibility image.
#
# The repository still runs the product from apps/*, so this image packages
# the current Gateway/Runtime and static workbench directly. When the
# frontend/backend migration lands, the dependency and source COPY steps can
# be split into dedicated builders without changing the Compose contract.

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node config/chihiro.default.json ./config/chihiro.default.json
COPY --chown=node:node deploy ./deploy

RUN mkdir -p /app/data /app/config \
  && chown -R node:node /app/data /app/config /app/deploy \
  && chmod +x /app/deploy/docker-entrypoint.sh

USER node

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -T 5 -O /dev/null http://127.0.0.1:3100/api/status || exit 1

ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]
CMD ["node", "apps/gateway/src/server.js"]
