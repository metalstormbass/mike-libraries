#!/bin/bash
set -euo pipefail

# Kill any existing processes on ports 3000 and 3001
for port in 3000 3001; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Killing existing process(es) on port $port..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done

echo "Installing dependencies for js/..."
(cd js && npm install)

echo "Installing dependencies for cg_js/..."
(cd cg_js && npm install)

echo "Starting js app on port 3000..."
(cd js && PORT=3000 npm start &)

echo "Starting cg_js app on port 3001..."
(cd cg_js && PORT=3001 npm start &)

wait
