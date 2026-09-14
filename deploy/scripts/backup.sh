#!/bin/sh
set -eu

archive=${1:-}
if [ -z "$archive" ]; then
  echo "usage: $0 OUTPUT.tar.gz" >&2
  exit 64
fi

case "$archive" in
  /*) ;;
  *) archive="$(pwd)/$archive" ;;
esac

compose_project=${COMPOSE_PROJECT_NAME:-chihiro}
for service in chihiro astrbot; do
  volume="${compose_project}_${service}-data"
  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    echo "missing volume: $volume" >&2
    exit 1
  fi
done

workdir=$(mktemp -d)
trap 'find "$workdir" -depth -delete 2>/dev/null || true' EXIT INT TERM
cp "$(dirname "$0")/../release-manifest.json" "$workdir/release-manifest.json"

for service in chihiro astrbot; do
  volume="${compose_project}_${service}-data"
  docker run --rm -v "$volume:/source:ro" -v "$workdir:/backup" alpine:3.23 \
    tar -C /source -czf "/backup/${service}-data.tar.gz" .
done

tar -C "$workdir" -czf "$archive" release-manifest.json chihiro-data.tar.gz astrbot-data.tar.gz
echo "$archive"
