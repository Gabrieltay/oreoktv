#!/usr/bin/env bash
# One-time installer: builds the Docker image and registers a systemd service
# that runs the container on boot. Re-runnable.
#
# Usage:
#   sudo ./scripts/install-service.sh
#
# Override defaults via env, e.g.:
#   sudo KTV_BASE_URL=http://192.168.50.150:8080 ./scripts/install-service.sh
set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Must be run as root (use sudo)." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
IMAGE_NAME="${IMAGE_NAME:-oreo-ktv}"
CONTAINER_NAME="${CONTAINER_NAME:-oreo-ktv}"
SERVICE_NAME="${SERVICE_NAME:-oreo-ktv.service}"
HOST_PORT="${HOST_PORT:-3001}"
DATA_DIR_HOST="${DATA_DIR_HOST:-$REPO_DIR/data}"
KTV_BASE_URL="${KTV_BASE_URL:-http://192.168.50.150:8080}"

# The user that will own the data dir and run docker. Falls back to the user
# who invoked sudo.
RUN_USER="${RUN_USER:-${SUDO_USER:-root}}"

echo "==> Repo:      $REPO_DIR"
echo "==> Image:     $IMAGE_NAME"
echo "==> Container: $CONTAINER_NAME"
echo "==> Service:   $SERVICE_NAME"
echo "==> Port:      $HOST_PORT"
echo "==> Data:      $DATA_DIR_HOST"
echo "==> KTV URL:   $KTV_BASE_URL"
echo "==> Run as:    $RUN_USER"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not installed. Install with: curl -fsSL https://get.docker.com | sh" >&2
  exit 1
fi

mkdir -p "$DATA_DIR_HOST/playlists"
chown -R "$RUN_USER":"$RUN_USER" "$DATA_DIR_HOST"

echo "==> Building image"
( cd "$REPO_DIR" && docker build -t "$IMAGE_NAME" . )

UNIT_PATH="/etc/systemd/system/$SERVICE_NAME"
echo "==> Writing $UNIT_PATH"

cat > "$UNIT_PATH" <<EOF
[Unit]
Description=oreo-ktv (KTV web remote)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=5
TimeoutStartSec=0

ExecStartPre=-/usr/bin/docker rm -f $CONTAINER_NAME
ExecStart=/usr/bin/docker run --rm \\
  --name $CONTAINER_NAME \\
  -p $HOST_PORT:3001 \\
  -e KTV_BASE_URL=$KTV_BASE_URL \\
  -v $DATA_DIR_HOST:/data \\
  $IMAGE_NAME
ExecStop=/usr/bin/docker stop $CONTAINER_NAME

[Install]
WantedBy=multi-user.target
EOF

echo "==> Reloading systemd"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo
echo "==> Installed. Useful commands:"
echo "    systemctl status $SERVICE_NAME"
echo "    journalctl -u $SERVICE_NAME -f"
echo "    sudo systemctl restart $SERVICE_NAME"
