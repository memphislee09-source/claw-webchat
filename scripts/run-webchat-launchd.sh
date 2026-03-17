#!/bin/zsh

set -euo pipefail

export HOME="/Users/memphis"
export PATH="/Users/memphis/.local/bin:/Users/memphis/.npm-global/bin:/Users/memphis/bin:/Users/memphis/.volta/bin:/Users/memphis/.asdf/shims:/Users/memphis/.bun/bin:/Users/memphis/Library/Application Support/fnm/aliases/default/bin:/Users/memphis/.fnm/aliases/default/bin:/Users/memphis/Library/pnpm:/Users/memphis/.local/share/pnpm:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_USE_SYSTEM_CA="1"
export NODE_EXTRA_CA_CERTS="/etc/ssl/cert.pem"
export OPENCLAW_BIN="/opt/homebrew/bin/openclaw"

mkdir -p "$HOME/.openclaw/logs"
cd /Users/memphis/.openclaw/workspace-mira/openclaw-webchat

exec /opt/homebrew/bin/node /Users/memphis/.openclaw/workspace-mira/openclaw-webchat/src/server.js
