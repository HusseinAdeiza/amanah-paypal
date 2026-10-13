#!/usr/bin/env bash
# Amanah single-service entry (Render/local). web/dist is built by the root build.
cd "$(dirname "$0")"
exec node dist/server.js
