#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:-anom-sheet}"
REPO_ARCHIVE_URL="${REPO_ARCHIVE_URL:-https://github.com/bwwq/anom-sheet/archive/refs/heads/main.tar.gz}"
IMAGE_TAG="${IMAGE_TAG:-${APP_NAME}:latest}"
HOST_PORT="${PORT:-3000}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
VOLUME_NAME="${VOLUME_NAME:-${APP_NAME}-data}"
CONTAINER_NAME="${CONTAINER_NAME:-${APP_NAME}}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

download_to() {
  url="$1"
  output="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$output"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$output" "$url"
  else
    echo "curl or wget is required." >&2
    exit 1
  fi
}

download_stdout() {
  url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$url"
  else
    echo "curl or wget is required." >&2
    exit 1
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  download_stdout "https://get.docker.com" | $SUDO sh
fi

if ! $SUDO docker info >/dev/null 2>&1; then
  if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl start docker >/dev/null 2>&1 || true
  fi
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

ARCHIVE="$TMP_DIR/source.tar.gz"
SRC_DIR="$TMP_DIR/source"
mkdir -p "$SRC_DIR"

download_to "$REPO_ARCHIVE_URL" "$ARCHIVE"

tar -xzf "$ARCHIVE" -C "$SRC_DIR" --strip-components=1

$SUDO docker build -t "$IMAGE_TAG" "$SRC_DIR"
$SUDO docker volume create "$VOLUME_NAME" >/dev/null
$SUDO docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
$SUDO docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${VOLUME_NAME}:/data" \
  -e "PORT=${CONTAINER_PORT}" \
  "$IMAGE_TAG"
