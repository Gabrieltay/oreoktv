#!/usr/bin/env bash
# Pulls latest main, rebuilds the Docker image, and restarts the systemd
# service if (and only if) there were new commits. Safe to run from cron.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
IMAGE_NAME="${IMAGE_NAME:-oreo-ktv}"
SERVICE_NAME="${SERVICE_NAME:-oreo-ktv.service}"
BRANCH="${BRANCH:-main}"

cd "$REPO_DIR"

echo "==> Fetching $BRANCH"
git fetch --quiet origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "==> Already up to date ($LOCAL). Nothing to do."
  exit 0
fi

echo "==> New commits: $LOCAL -> $REMOTE"
git reset --hard "origin/$BRANCH"

echo "==> Building image $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "==> Restarting $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

echo "==> Done."
