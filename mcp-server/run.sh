#!/bin/bash
# Load env vars from the main app's .env.local, then start the MCP server
set -a
source "$(dirname "$0")/../.env.local" 2>/dev/null || true
set +a
exec /Users/abdallahkooli/.nvm/versions/node/v20.20.2/bin/node "$(dirname "$0")/dist/index.js"
