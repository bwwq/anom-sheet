#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:-anom-sheet}"
REPO_ARCHIVE_URL="${REPO_ARCHIVE_URL:-https://github.com/bwwq/anom-sheet/archive/refs/heads/main.tar.gz}"
IMAGE_TAG="${IMAGE_TAG:-${APP_NAME}:latest}"
HOST_PORT="${PORT:-6699}"
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

port_is_busy() {
  port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk -v port=":$port" '$4 ~ port "$" { found = 1 } END { exit found ? 0 : 1 }'
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk -v port=":$port" '$4 ~ port "$" { found = 1 } END { exit found ? 0 : 1 }'
    return $?
  fi
  return 1
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

if port_is_busy "$HOST_PORT"; then
  echo "Port ${HOST_PORT} is already in use. Free it or rerun with PORT=<port>." >&2
  exit 1
fi

CONTAINER_ID="$($SUDO docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${VOLUME_NAME}:/data" \
  -e "PORT=${CONTAINER_PORT}" \
  "$IMAGE_TAG")"

READY=0
attempt=1
while [ "$attempt" -le 30 ]; do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS "http://127.0.0.1:${HOST_PORT}/" >/dev/null 2>&1; then
      READY=1
      break
    fi
  elif command -v wget >/dev/null 2>&1; then
    if wget -qO- "http://127.0.0.1:${HOST_PORT}/" >/dev/null 2>&1; then
      READY=1
      break
    fi
  else
    READY=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Container started but did not answer successfully on port ${HOST_PORT}." >&2
  $SUDO docker logs --tail 120 "$CONTAINER_ID" >&2 || true
  exit 1
fi

echo "Anom Sheet is running at http://127.0.0.1:${HOST_PORT}/"
