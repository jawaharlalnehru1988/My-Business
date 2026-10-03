#!/usr/bin/env bash
set -e

APP_DIR="/var/www/My-Business"
cd "$APP_DIR"

echo "=========================================="
echo " Starting My-Business Deployment"
echo " Time: $(date)"
echo "=========================================="

TARGET_SERVICES=("$@")

if [ ${#TARGET_SERVICES[@]} -eq 0 ]; then
  # Auto-detection mode based on git diff
  PREV_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")

  echo "=== Pulling latest changes from origin/master ==="
  git pull origin master

  NEW_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "")
  echo "Previous commit: $PREV_COMMIT"
  echo "Current commit:  $NEW_COMMIT"

  if [ -n "$PREV_COMMIT" ] && [ "$PREV_COMMIT" != "$NEW_COMMIT" ]; then
    CHANGED_FILES=$(git diff --name-only "$PREV_COMMIT" "$NEW_COMMIT")
  else
    CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
  fi

  echo "=== Changed files ==="
  if [ -z "$CHANGED_FILES" ]; then
    echo "No file changes detected."
  else
    echo "$CHANGED_FILES"
  fi

  REBUILD_LIST=()
  REBUILD_ALL=false

  if echo "$CHANGED_FILES" | grep -qE "docker-compose\.yml"; then
    echo "docker-compose.yml changed -> Full rebuild/reload required."
    REBUILD_ALL=true
  else
    echo "$CHANGED_FILES" | grep -q "^react-frontend/" && REBUILD_LIST+=("frontend")
    echo "$CHANGED_FILES" | grep -q "^backend/" && REBUILD_LIST+=("backend")
    echo "$CHANGED_FILES" | grep -q "^auth-service/" && REBUILD_LIST+=("auth-service")
    echo "$CHANGED_FILES" | grep -q "^api-gateway/" && REBUILD_LIST+=("api-gateway")
    echo "$CHANGED_FILES" | grep -q "^accounting-service/" && REBUILD_LIST+=("accounting-service")
    echo "$CHANGED_FILES" | grep -q "^inventory-service/" && REBUILD_LIST+=("inventory-service")
    echo "$CHANGED_FILES" | grep -q "^reporting-service/" && REBUILD_LIST+=("reporting-service")
    echo "$CHANGED_FILES" | grep -q "^notification-service/" && REBUILD_LIST+=("notification-service")
    echo "$CHANGED_FILES" | grep -q "^service-registry/" && REBUILD_LIST+=("service-registry")
  fi

  if [ "$REBUILD_ALL" = true ]; then
    echo "=== Rebuilding all services via Docker Compose ==="
    docker compose up -d --build
  elif [ ${#REBUILD_LIST[@]} -gt 0 ]; then
    echo "=== Rebuilding modified service(s): ${REBUILD_LIST[*]} ==="
    docker compose up -d --build "${REBUILD_LIST[@]}"
  else
    echo "No microservice code modified. Ensuring running containers remain active..."
    docker compose up -d
  fi
else
  # Manual or explicit service selection
  if [ "${TARGET_SERVICES[0]}" = "all" ]; then
    echo "=== Rebuilding all services (explicit 'all' requested) ==="
    git pull origin master
    docker compose up -d --build
  else
    echo "=== Rebuilding explicitly specified service(s): ${TARGET_SERVICES[*]} ==="
    git pull origin master
    docker compose up -d --build "${TARGET_SERVICES[@]}"
  fi
fi

echo "=== Cleaning up dangling Docker images ==="
docker image prune -f

echo "=========================================="
echo " Deployment Complete! Service status:"
echo "=========================================="
docker compose ps
