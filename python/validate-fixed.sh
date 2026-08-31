#!/usr/bin/env bash
#
# validate-fixed.sh — Demonstrate that the CHAINGUARD REMEDIATED build swaps the
# vulnerable upstream pins for +cgr remediated packages without breaking the app.
#
# Boots python-app:fixed, confirms the Flask app STILL serves normally (the
# backported patches do not break it), confirms the backport-relevant packages
# (aiohttp, requests, Pillow, python-multipart) all carry the +cgr suffix, then
# proves the fix HOLDS by running the same live aiohttp CVE-2024-23334 exploit
# used in validate-vuln.sh — on this image the path traversal must be blocked.
# Expected outcome: app healthy, every pin remediated, exploit blocked.
#
# Prereq: ./build.sh fixed   (builds python-app:fixed)
#
# Usage:
#   ./validate-fixed.sh
#
set -euo pipefail

IMG=python-app:fixed
CT=python-app-fixed
PORT=5002
HOST="http://localhost:$PORT"

# packages this demo remediates via the Chainguard python-remediated index
PKGS=(aiohttp requests Pillow python-multipart)

bold()  { printf '\033[1m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
dim()   { printf '\033[2m%s\033[0m\n' "$1"; }
rule()  { printf '\033[2m%s\033[0m\n' "----------------------------------------------------------------"; }

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! docker image inspect "$IMG" >/dev/null 2>&1; then
  red "Image $IMG not found. Run ./build.sh fixed first."; exit 1
fi

bold "==================================================================="
bold " FIXED build — Chainguard python-remediated packages (+cgr.N)"
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
bold ">> Baseline: legitimate serving still works (patches did not break it)"
rule
HEALTH=0
for p in "/health" "/items"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HOST$p")"
  printf "   GET %-18s -> HTTP %s\n" "$p" "$code"
  [ "$p" = "/health" ] && [ "$code" = "200" ] && HEALTH=1
done
rule

echo
bold ">> Confirm these are Chainguard remediated libraries"
rule
CGR_OK=1
for pkg in "${PKGS[@]}"; do
  ver="$(pkgver "$pkg")"
  case "$ver" in
    *+cgr.*)
      green "   + $pkg $ver — carries the +cgr local-version suffix";;
    "")
      red   "   ! $pkg — not installed?"; CGR_OK=0;;
    *)
      red   "   ! $pkg $ver — NOT a +cgr remediated build"; CGR_OK=0;;
  esac
done
dim "   + remediated builds resolved from https://libraries.cgr.dev/python-remediated/simple"
dim "   + same public versions with the CVE fixes backported"
rule

echo
bold ">> Live exploit check: aiohttp CVE-2024-23334 must be BLOCKED here"
rule
dim "   Runs the SAME exploit validate-vuln.sh uses, against this image's aiohttp:"
dim "     - starts an aiohttp static server (follow_symlinks=True) rooted at a temp dir"
dim "     - drops a secret file OUTSIDE that root"
dim "     - sends a raw GET /static/../..[x20]/tmp/cve_probe_secret.txt to escape it"
dim "   On the remediated aiohttp the ../ traversal is confined to the static root,"
dim "   so the secret must NOT leak: expect HTTP 404 (BLOCKED), not 200."
rule
PROBE="$(cd "$(dirname "$0")" && pwd)/cve_2024_23334_probe.py"
FIX_HOLDS=0
if [ ! -f "$PROBE" ]; then
  red "   probe not found: $PROBE"
else
  docker cp -q "$PROBE" "$CT:/tmp/cve_probe.py"
  set +e
  OUT="$(docker exec "$CT" python /tmp/cve_probe.py 2>&1)"; RC=$?
  set -e
  printf '%s\n' "$OUT" | sed 's/^/   /'
  if [ "$RC" = "1" ]; then
    green "   => fix holds: the traversal was rejected on the remediated aiohttp"; FIX_HOLDS=1
  elif [ "$RC" = "0" ]; then
    red   "   => EXPLOIT SUCCEEDED: the remediated image is still vulnerable!"
  else
    red   "   => probe error (could not determine exploitability)"
  fi
fi
rule

echo
bold "==================== VERDICT ===================="
PASS=1
if [ "$HEALTH" = "1" ]; then
  green "HEALTHY: the app serves normally on the remediated build."
else
  red "FAIL: the app did not respond healthy on the remediated build."; PASS=0
fi
[ "$CGR_OK" = "1" ] || { red "FAIL: not every backport-relevant package is a +cgr remediated build."; PASS=0; }
[ "$FIX_HOLDS" = "1" ] || { red "FAIL: the CVE-2024-23334 exploit was not confirmed blocked on this image."; PASS=0; }

if [ "$PASS" = "1" ]; then
  green "FIXED: Chainguard remediated packages replace the vulnerable pins, the app still serves,"
  green "and the aiohttp CVE-2024-23334 path traversal is no longer exploitable."
  dim "Confirm the CVE delta with:  grype $IMG   (compare against grype python-app:vulnerable)"
  exit 0
else
  exit 1
fi
