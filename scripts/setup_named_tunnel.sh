#!/usr/bin/env bash
# ==============================================================================
# Antara Named Cloudflare Tunnel Setup Script
# Creates and configures a persistent named tunnel routing port 8001 (FastAPI)
# Strictly preserves ports 5000 and 8000 (reserved webpages)
# ==============================================================================

set -euo pipefail

TUNNEL_NAME="antara-ml-tunnel"
LOCAL_PORT=8001
HOSTNAME="ml.antara.app" # Replace with your configured Cloudflare DNS hostname

echo "========================================================"
echo "      ANTARA NAMED CLOUDFLARE TUNNEL PROVISIONER       "
echo "========================================================"
echo "[*] Target service: FastAPI ML backend on 127.0.0.1:${LOCAL_PORT}"
echo "[*] Protected ports: 5000 (webpage 1), 8000 (webpage 2)"
echo ""

# Check cloudflared binary
if ! command -v cloudflared &> /dev/null; then
    echo "[-] cloudflared CLI is not installed on this system."
    echo "    To install on Ubuntu/Debian server:"
    echo "    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
    echo "    sudo dpkg -i cloudflared.deb"
    exit 1
fi

echo "[1/4] Authenticating cloudflared (opens Cloudflare login if cert missing)..."
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    cloudflared tunnel login
fi

echo "[2/4] Creating named tunnel: ${TUNNEL_NAME}..."
cloudflared tunnel create "${TUNNEL_NAME}" || echo "[!] Tunnel ${TUNNEL_NAME} may already exist."

echo "[3/4] Generating configuration file /etc/cloudflared/config.yml..."
TUNNEL_ID=$(cloudflared tunnel list | grep "${TUNNEL_NAME}" | awk '{print $1}' || echo "your-tunnel-id")
sudo mkdir -p /etc/cloudflared

sudo tee /etc/cloudflared/config.yml > /dev/null <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /root/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: ${HOSTNAME}
    service: http://127.0.0.1:${LOCAL_PORT}
  - service: http_status:404
EOF

echo "[4/4] Routing DNS to named tunnel..."
cloudflared tunnel route dns "${TUNNEL_NAME}" "${HOSTNAME}" || echo "[!] Run: cloudflared tunnel route dns ${TUNNEL_NAME} ${HOSTNAME}"

echo ""
echo "[+] Installing and starting cloudflared systemd service..."
sudo cloudflared service install || true
sudo systemctl enable cloudflared
sudo systemctl restart cloudflared

echo "[SUCCESS] Named Cloudflare Tunnel configured successfully!"
echo "Hostname: https://${HOSTNAME} -> http://127.0.0.1:${LOCAL_PORT}"
echo "Remember to record this in /root/antara/.env-remember"
