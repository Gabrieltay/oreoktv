#!/usr/bin/env bash
# Build the Docker image on this Mac (for the Pi's arch), ship it to the Pi
# over SSH, and restart the systemd service so it picks up the new image.
#
# Usage:
#   ./scripts/deploy.sh
#
# Override defaults via env, e.g.:
#   PI_HOST=oreopi.local PI_USER=gabriel ./scripts/deploy.sh
set -euo pipefail

PI_HOST="${PI_HOST:-oreopi.local}"
PI_USER="${PI_USER:-gabriel}"
IMAGE_NAME="${IMAGE_NAME:-oreo-ktv}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
PLATFORM="${PLATFORM:-linux/arm64}"
SERVICE_NAME="${SERVICE_NAME:-oreo-ktv.service}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

SSH_TARGET="$PI_USER@$PI_HOST"
IMAGE_REF="$IMAGE_NAME:$IMAGE_TAG"

# Reuse a single SSH connection for all three remote calls (preflight, image
# load, systemctl) so the user only authenticates once.
SSH_CTRL_DIR="$(mktemp -d -t oreo-ktv-ssh.XXXXXX)"
SSH_CTRL_PATH="$SSH_CTRL_DIR/ctl"
SSH_OPTS=(-o "ControlMaster=auto" -o "ControlPath=$SSH_CTRL_PATH" -o "ControlPersist=60")

cleanup() {
  ssh "${SSH_OPTS[@]}" -O exit "$SSH_TARGET" >/dev/null 2>&1 || true
  rm -rf "$SSH_CTRL_DIR"
}
trap cleanup EXIT

echo "==> Target:    $SSH_TARGET"
echo "==> Image:     $IMAGE_REF ($PLATFORM)"
echo "==> Service:   $SERVICE_NAME"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found on this Mac." >&2
  exit 1
fi

echo "==> SSH preflight (you may be prompted for $PI_USER's password)"
ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$SSH_TARGET" true

echo "==> Building $IMAGE_REF for $PLATFORM"
# --load puts the image into the local daemon so `docker save` can find it.
docker buildx build \
  --platform "$PLATFORM" \
  -t "$IMAGE_REF" \
  --load \
  "$REPO_DIR"

echo "==> Shipping image to $PI_HOST (this is the slow part)"
docker save "$IMAGE_REF" | gzip | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "gunzip | docker load"

echo "==> Restarting $SERVICE_NAME on $PI_HOST (sudo password may be prompted)"
ssh -t "${SSH_OPTS[@]}" "$SSH_TARGET" "sudo systemctl restart $SERVICE_NAME"

echo "==> Done. Tail logs with:"
echo "    ssh $SSH_TARGET 'journalctl -u $SERVICE_NAME -f'"
