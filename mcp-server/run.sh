#!/bin/bash
# Env vars (GOOGLE_VERTEX_SA_JSON, ANTHROPIC_API_KEY, TAVILY_API_KEY) are
# injected directly by Claude Desktop via the "env" field in claude_desktop_config.json.
# Do NOT source .env.local here — the multi-line JSON private key breaks bash parsing.
exec /Users/abdallahkooli/.nvm/versions/node/v20.20.2/bin/node "$(dirname "$0")/dist/index.js"
