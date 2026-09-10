#!/bin/bash
# Voice Emotion Detection - launcher for macOS / Linux
# Usage: ./start.sh   (or: bash start.sh)
set -e
cd "$(dirname "$0")"

PORT=8000
URL="http://localhost:$PORT"

# Pick a Python that TensorFlow supports (3.12 preferred)
PYTHON=""
for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON=$(command -v "$candidate")
        break
    fi
done
if [ -z "$PYTHON" ]; then
    echo "Error: Python 3 was not found. Install Python 3.12 and try again."
    exit 1
fi

# Create the virtual environment and install dependencies on first run
if [ ! -f "venv/bin/uvicorn" ]; then
    echo "First run: creating virtual environment (this can take a few minutes)..."
    "$PYTHON" -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

# Refuse to double-start if something is already on the port
if curl -s -o /dev/null "$URL"; then
    echo "A server is already running at $URL - opening it in your browser."
    if command -v open >/dev/null 2>&1; then open "$URL"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"; fi
    exit 0
fi

echo "Starting Voice Emotion Detection server on $URL ..."
./venv/bin/uvicorn main:app --host 127.0.0.1 --port "$PORT" &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

# Wait until the server answers. First run downloads the emotion2vec+
# checkpoint (~1.1 GB), which can take several minutes.
WAITED=0
until curl -s -o /dev/null "$URL"; do
    sleep 2
    WAITED=$((WAITED + 2))
    if [ $((WAITED % 30)) -eq 0 ]; then
        echo "Still starting... (first run downloads the ~1.1 GB emotion model; ${WAITED}s elapsed)"
    fi
    if [ $WAITED -ge 1800 ]; then
        echo "Server did not start within 30 minutes; check the log output above."
        exit 1
    fi
done

if command -v open >/dev/null 2>&1; then
    open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
else
    echo "Open $URL in your browser."
fi

echo "Server is running at $URL  (press Ctrl+C to stop)"
wait $SERVER_PID
