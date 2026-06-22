#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  DRY_RUN=true
fi

APP="owlcmstracker"

status_output="$(fly status -a "$APP")"
image="$(
  printf '%s\n' "$status_output" \
    | awk -F'│' '$1 ~ /^[[:space:]]*Image[[:space:]]*$/ { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2; exit }'
)"

if [ -z "$image" ]; then
  echo "Could not determine current image for Fly app: $APP" >&2
  echo "$status_output" >&2
  exit 1
fi

if [[ "$image" != */* ]]; then
  image="registry.fly.io/$image"
fi

if $DRY_RUN; then
  echo "Dry run — commands that would be executed:"
  echo "  fly deploy --app $APP --image $image --ha=false"
  echo "  fly scale count 1 --app $APP --yes"
  echo "  fly status -a $APP"
else
  echo "Redeploying $APP from image: $image"
  fly deploy --app "$APP" --image "$image" --ha=false
  fly scale count 1 --app "$APP" --yes
  fly status -a "$APP"
fi
