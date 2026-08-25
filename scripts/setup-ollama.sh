#!/usr/bin/env bash
# ==============================================================================
# Set up local Ollama on this box (intended for `draftsmanbrain`, the same
# host that runs antara-ml.service) for Phase 2's LLM features:
# categorization (backend/app/ml/llm_features.py), insights, and chat.
#
# This script was written and reviewed in a sandboxed session with no SSH/
# network access to draftsmanbrain — it has NOT been run against the real
# box. Run it there yourself and check its output; don't take "the script
# exists" as "Ollama is installed."
#
# Usage: ./scripts/setup-ollama.sh
# ==============================================================================
set -euo pipefail

if ! command -v ollama >/dev/null 2>&1; then
  echo "[*] Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "[+] Ollama already installed ($(ollama --version 2>&1 | head -1))."
fi

echo "[*] Pulling qwen2.5:1.5b (transaction categorization)..."
ollama pull qwen2.5:1.5b

echo "[*] Pulling qwen2.5:7b-instruct-q4_K_M (insights + chat)..."
ollama pull qwen2.5:7b-instruct-q4_K_M

echo
echo "[i] Not setting OLLAMA_KEEP_ALIVE — leaving Ollama's default idle-unload"
echo "    (5 minutes) in place so the two models don't both try to stay"
echo "    resident on the GTX 1660 Super's 6GB VRAM at once. If you ever do"
echo "    override it, set OLLAMA_KEEP_ALIVE in antara-ml.service's"
echo "    environment (backend/app/ml/ollama_client.py reads it) rather than"
echo "    editing the client code."
echo
echo "[*] Checking Ollama is serving on localhost:11434..."
curl -sf http://localhost:11434/api/tags >/dev/null && echo "[+] Ollama is up." || {
  echo "[!] Ollama isn't responding on localhost:11434 yet — check 'systemctl status ollama' (or however it's run on this box) and re-run this check."
  exit 1
}

echo
echo "[+] Done. antara-ml.service (backend/app/main.py) will pick these models"
echo "    up automatically via OLLAMA_BASE_URL=http://localhost:11434 (the"
echo "    default) — no restart needed unless it was already failing to reach"
echo "    Ollama before now."
