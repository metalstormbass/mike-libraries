#!/usr/bin/env bash
#
# validate-vuln.sh — Demonstrate that the UPSTREAM build ships packages pinned
# to known-CVE versions straight from public PyPI, AND that the vulnerability is
# actually exploitable (not just a matching version string).
#
# Boots python-app:vulnerable, confirms the Flask app serves, reports the
# resolved versions of the backport-relevant packages (aiohttp, requests,
# Pillow, python-multipart), then ACTIVELY EXPLOITS aiohttp CVE-2024-23334:
# it stands up an aiohttp static server inside the container and sends a raw
# path-traversal request that leaks a canary file outside the static root.
# Expected outcome: plain upstream pins, and the traversal succeeds.
#
# Prereq: ./build.sh vulnerable   (builds python-app:vulnerable)
#
# Usage:
#   ./validate-vuln.sh
#
set -euo pipefail

IMG=python-app:vulnerable
CT=python-app-vulnerable
PORT=5001
HOST="http://localhost:$PORT"

# packages whose upstream pins carry the CVEs this demo remediates
PKGS=(aiohttp requests Pillow python-multipart)

bold()  { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
dim()   { printf '\033[2m%s\033[0m\n' "$1"; }
rule()  { printf '\033[2m%s\033[0m\n' "----------------------------------------------------------------"; }

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! docker image inspect "$IMG" >/dev/null 2>&1; then
  red "Image $IMG not found. Run ./build.sh vulnerable first."; exit 1
fi

bold "==================================================================="
bold " VULNERABLE build — upstream PyPI pins with known CVEs"
bold "==================================================================="

bold ">> Booting $IMG as '$CT' on $HOST"
docker rm -f "$CT" >/dev/null 2>&1 || true
docker run -d --rm --name "$CT" -p "$PORT:5000" "$IMG" >/dev/null
for _ in $(seq 1 40); do
  curl -fsS -o /dev/null "$HOST/health" 2>/dev/null && break; sleep 0.5
done

echo "   container : $(docker ps --filter name=^/${CT}$ --format '{{.ID}}  {{.Image}}  {{.Status}}')"

FREEZE="$(docker exec "$CT" pip freeze 2>/dev/null || true)"
pkgver() { printf '%s\n' "$FREEZE" | grep -iE "^$1==" | head -1 | sed -E 's/^[^=]+==//'; }

echo
bold ">> Baseline: the app serves normally"
rule
for p in "/health" "/items"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HOST$p")"
  printf "   GET %-18s -> HTTP %s\n" "$p" "$code"
done
rule

echo
bold ">> Resolved versions of the backport-relevant packages"
rule
VULN=0
for pkg in "${PKGS[@]}"; do
  ver="$(pkgver "$pkg")"
  case "$ver" in
    *+cgr.*) green "   $pkg $ver — remediated (unexpected in the vulnerable build)";;
    "")      red   "   $pkg — not installed?";;
    *)       red   "   $pkg $ver — plain upstream pin, no +cgr remediation"; VULN=1;;
  esac
done
rule

echo
bold ">> Live exploit: aiohttp CVE-2024-23334 (static-file path traversal)"
rule
dim "   What the exploit does (inside the container, against the shipped aiohttp):"
dim "     1. starts an aiohttp static file server rooted at /tmp/cve_probe_static"
dim "        with follow_symlinks=True (a common config for serving assets)"
dim "     2. writes a secret file OUTSIDE that root at /tmp/cve_probe_secret.txt"
dim "     3. sends a RAW request: GET /static/../../..[x20]/tmp/cve_probe_secret.txt"
dim "        (raw socket, not an HTTP client — a client would collapse the ../ away)"
dim "   The ../ sequences should never escape the static root. On aiohttp < 3.9.2"
dim "   they do, so the server returns the secret file's contents (HTTP 200)."
dim "   VULNERABLE = the secret canary leaks;  BLOCKED = HTTP 404."
rule
PROBE="$(cd "$(dirname "$0")" && pwd)/cve_2024_23334_probe.py"
EXPLOITED=0
if [ ! -f "$PROBE" ]; then
  red "   probe not found: $PROBE"
else
  docker cp -q "$PROBE" "$CT:/tmp/cve_probe.py"
  set +e
  OUT="$(docker exec "$CT" python /tmp/cve_probe.py 2>&1)"; RC=$?
  set -e
  printf '%s\n' "$OUT" | sed 's/^/   /'
  if [ "$RC" = "0" ]; then
    red   "   => EXPLOIT SUCCEEDED: the running aiohttp is actually vulnerable"; EXPLOITED=1
  elif [ "$RC" = "1" ]; then
    green "   => exploit blocked: traversal rejected (unexpected in the vulnerable build)"
  else
    red   "   => probe error (could not determine exploitability)"
  fi
fi
rule

echo
bold "==================== VERDICT ===================="
if [ "$VULN" = "1" ] && [ "$EXPLOITED" = "1" ]; then
  red "VULNERABLE: this image ships upstream PyPI pins with known CVEs and the"
  red "aiohttp CVE-2024-23334 path traversal is exploitable on the running image."
  dim "Confirm the full CVE inventory with:  grype $IMG"
  exit 0
elif [ "$VULN" = "1" ]; then
  red "VULNERABLE (by version): upstream PyPI pins with known CVEs are present,"
  red "but the CVE-2024-23334 probe did not confirm exploitation — see above."
  dim "Confirm the full CVE inventory with:  grype $IMG"
  exit 0
else
  green "No upstream vulnerable pins detected — this may already be a remediated image."
  exit 1
fi
