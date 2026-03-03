#!/bin/bash
# Expose local server for Atoms webhooks (alternative to ngrok if you have SSL issues)
# Run: ./scripts/tunnel.sh   (with server already running on port 4000)
echo "Starting tunnel on port 4000..."
echo "Use the URL below in Atoms API config. Add header: Bypass-Tunnel-Reminder = true"
echo ""
npx --yes localtunnel --port 4000
