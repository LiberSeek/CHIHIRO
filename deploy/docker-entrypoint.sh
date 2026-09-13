#!/bin/sh
set -eu

node /app/deploy/prepare-config.mjs
exec "$@"
