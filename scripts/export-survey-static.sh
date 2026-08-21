#!/usr/bin/env bash
# ==============================================================================
# Export the standalone /survey page as a static site for GitHub Pages.
#
# The rest of the Antara app (dashboard, graph, predict, admin) talks to
# Firebase/the ML API purely client-side already, so the whole app *could*
# static-export cleanly — but /survey is the only page meant to be public,
# so this script pulls out just the HTML + JS/CSS chunks that page actually
# references, rather than shipping the admin panel etc. to a public host.
#
# Usage:
#   BASE_PATH=/antarasurvey ./scripts/export-survey-static.sh [output_dir]
#
# BASE_PATH must match the GitHub Pages project path, e.g. a repo named
# "antarasurvey" served at https://<user>.github.io/antarasurvey/ needs
# BASE_PATH=/antarasurvey. Leave unset for a custom domain / user site
# served from the root.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"
OUT_DIR="${1:-${SCRIPT_DIR}/../publish/survey}"
BASE_PATH="${BASE_PATH:-}"

echo "[*] Building static export (BASE_PATH='${BASE_PATH}')..."
cd "${FRONTEND_DIR}"
STATIC_EXPORT=true STATIC_EXPORT_BASE_PATH="${BASE_PATH}" npx next build

EXPORTED_DIR="${FRONTEND_DIR}/out"
SURVEY_HTML="${EXPORTED_DIR}/survey.html"
if [ ! -f "${SURVEY_HTML}" ]; then
  # trailingSlash builds emit survey/index.html instead
  SURVEY_HTML="${EXPORTED_DIR}/survey/index.html"
fi
if [ ! -f "${SURVEY_HTML}" ]; then
  echo "[!] Could not find exported survey.html — check the `next build` output above."
  exit 1
fi

echo "[*] Collecting assets referenced by the survey page..."
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"
cp "${SURVEY_HTML}" "${OUT_DIR}/index.html"

# Pull every /_next/... asset path referenced from the survey page's HTML —
# scripts, stylesheets, and preload/prefetch links — and mirror just those
# files (with directory structure) into the publish dir.
grep -oE '/_next/[A-Za-z0-9_./-]+\.(js|css)' "${SURVEY_HTML}" | sort -u | while read -r asset; do
  rel="${asset#/}"
  mkdir -p "${OUT_DIR}/$(dirname "${rel}")"
  cp "${EXPORTED_DIR}/${rel}" "${OUT_DIR}/${rel}"
done

# GitHub Pages runs Jekyll by default, which ignores `_next` (underscore-
# prefixed dirs) unless told not to.
touch "${OUT_DIR}/.nojekyll"

echo "[+] Static survey site ready at: ${OUT_DIR}"
echo "    Copy its contents to the root of your GitHub Pages branch."
