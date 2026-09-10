#!/bin/bash
# Starts the voice emotion backend and the SAHAAS frontend together.
# Usage: ./start.sh   -> open http://localhost:3000
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"

PYTHON=""
for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON=$(command -v "$candidate")
        break
    fi
done
if [ -z "$PYTHON" ]; then
    echo "Error: Python 3.12 is required for the backend."
    exit 1
fi

if [ ! -x "$ROOT/backend/venv/bin/uvicorn" ]; then
    echo "First run: creating the backend virtual environment (this can take a few minutes)..."
    "$PYTHON" -m venv "$ROOT/backend/venv"
    "$ROOT/backend/venv/bin/pip" install --upgrade pip
    "$ROOT/backend/venv/bin/pip" install -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "First run: installing frontend dependencies..."
    (cd "$ROOT/frontend" && npm install)
fi

(cd "$ROOT/backend" && exec ./venv/bin/uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT") &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT INT TERM

echo "Backend starting on http://127.0.0.1:$BACKEND_PORT (first run downloads ~3.5 GB of models)."
echo "Frontend: http://localhost:3000 - voice check-ins work once the backend finishes loading."
cd "$ROOT/frontend"
BACKEND_URL="http://127.0.0.1:$BACKEND_PORT" npm run dev
