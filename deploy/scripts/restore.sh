#!/bin/sh
set -eu

archive=${1:-}
if [ -z "$archive" ] || [ ! -f "$archive" ]; then
  echo "usage: $0 BACKUP.tar.gz" >&2
  exit 64
fi
if [ "${CHIHIRO_RESTORE_CONFIRM:-}" != "restore" ]; then
  echo "set CHIHIRO_RESTORE_CONFIRM=restore after stopping the Compose stack" >&2
  exit 65
fi

compose_project=${COMPOSE_PROJECT_NAME:-chihiro}
workdir=$(mktemp -d)
trap 'find "$workdir" -depth -delete 2>/dev/null || true' EXIT INT TERM
tar -C "$workdir" -xzf "$archive"

for service in chihiro astrbot; do
  payload="$workdir/${service}-data.tar.gz"
  [ -f "$payload" ] || { echo "missing payload: ${service}-data.tar.gz" >&2; exit 1; }
  volume="${compose_project}_${service}-data"
  docker volume create "$volume" >/dev/null
  docker run --rm -v "$volume:/target" alpine:3.23 sh -c 'find /target -mindepth 1 -depth -delete'
  docker run --rm -v "$volume:/target" -v "$workdir:/backup:ro" alpine:3.23 \
    tar -C /target -xzf "/backup/${service}-data.tar.gz"
done

echo "restored volumes for project $compose_project"
