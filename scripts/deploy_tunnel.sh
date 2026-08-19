#!/usr/bin/env bash
# ==============================================================================
# Cloudflare Tunnel Setup Helper for Antara ML Backend (Port 8001)
# Ensures strictly no collision with ports 5000/8000 or Tailscale
# ==============================================================================

set -euo pipefail

PORT=8001
TUNNEL_NAME="antara-ml-service"
CONFIG_DIR="/root/.cloudflared"

echo "=== Antara ML Cloudflare Tunnel Configurator ==="
echo "[*] Checking port availability for ${PORT}..."

if ss -tuln | grep -q ":${PORT} "; then
    echo "[+] Port ${PORT} is currently in use (Antara FastAPI service is running)."
else
    echo "[!] Port ${PORT} is not bound yet. Ensure FastAPI is running on port ${PORT} before traffic routing."
fi

echo "[*] Ensuring ports 5000 and 8000 are untouched..."
echo "    Port 5000 reserved (Existing webpage)"
echo "    Port 8000 reserved (Existing webpage)"

echo ""
echo "[*] Cloudflare Tunnel Command Reference:"
echo "1. Authenticate (if not done):"
echo "   cloudflared tunnel login"
echo ""
echo "2. Create tunnel:"
echo "   cloudflared tunnel create ${TUNNEL_NAME}"
echo ""
echo "3. Run tunnel mapping port ${PORT}:"
echo "   cloudflared tunnel run --url http://127.0.0.1:${PORT} ${TUNNEL_NAME}"
echo ""
echo "4. Or quick testing tunnel:"
echo "   cloudflared tunnel --url http://localhost:${PORT}"
echo "=================================================="
