#!/bin/bash
set -euo pipefail

echo "Removing node_modules..."
rm -rf js/node_modules cg_js/node_modules

echo "Cleanup complete."
