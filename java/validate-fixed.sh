#!/usr/bin/env bash
#
# validate-fixed.sh — Demonstrate that the CHAINGUARD REMEDIATED build swaps the
# EOL Spring Boot 3.2.1 line for the Chainguard-extended 3.2 line without
# breaking the app.
#
# Boots java-app:fixed, confirms the Spring Boot app STILL serves normally (the
# backported patches do not break it), confirms spring-boot itself is a
# Chainguard -cgr extended-support build (3.2.12-0.cgr.1 from the java-remediated
# repo) and that its BOM pulled every CVE-relevant transitive jar up past its
# CVE-fix floor, then proves the fix HOLDS by running the same live spring-web
# CVE-2024-22243 exploit used in validate-vuln.sh — here the host allow-list must
# reject the crafted URL. Expected outcome: app healthy, jars remediated, exploit blocked.
#
# Prereq: ./build.sh fixed   (builds java-app:fixed)
#
# Usage:
#   ./validate-fixed.sh
#
set -euo pipefail

IMG=java-app:fixed
CT=java-app-fixed
PORT=8082
HOST="http://localhost:$PORT"

# jar | first version fixing its known CVEs (see validate-vuln.sh for the CVEs)
CHECKS=(
  "spring-web|6.1.4"
  "spring-webmvc|6.1.14"
  "spring-security-core|6.2.2"
  "tomcat-embed-core|10.1.19"
)

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
bold " FIXED build — Chainguard-extended Spring Boot 3.2 line (-cgr)"
bold "==================================================================="

bold ">> Booting $IMG as '$CT' on $HOST"
docker rm -f "$CT" >/dev/null 2>&1 || true
docker run -d --rm --name "$CT" -p "$PORT:8080" "$IMG" >/dev/null
for _ in $(seq 1 120); do
  curl -fsS -o /dev/null "$HOST/api/health" 2>/dev/null && break; sleep 0.5
done

echo "   container : $(docker ps --filter name=^/${CT}$ --format '{{.ID}}  {{.Image}}  {{.Status}}')"

TMP="$(mktemp -d)"
docker cp -q "$CT:/app/app.jar" "$TMP/app.jar"
JARS="$(unzip -Z1 "$TMP/app.jar" 'BOOT-INF/lib/*.jar' | sed 's|BOOT-INF/lib/||')"
rm -rf "$TMP"
jarver() { printf '%s\n' "$JARS" | grep -E "^$1-[0-9]" | head -1 | sed -E "s/^$1-(.+)\.jar$/\1/"; }
ver_lt() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -1)" = "$1" ]; }

echo
bold ">> Baseline: legitimate serving still works (patches did not break it)"
rule
HEALTH=0
for p in "/api/health" "/api/items"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HOST$p")"
  printf "   GET %-18s -> HTTP %s\n" "$p" "$code"
  [ "$p" = "/api/health" ] && [ "$code" = "200" ] && HEALTH=1
done
rule

echo
bold ">> Confirm this is the Chainguard-extended Spring Boot line"
rule
CGR_OK=1
BOOT_VER="$(jarver spring-boot)"
case "$BOOT_VER" in
  *cgr*) green "   + spring-boot $BOOT_VER — Chainguard -cgr extended-support build";;
  "")    red   "   ! spring-boot — not found in BOOT-INF/lib?"; CGR_OK=0;;
  *)     red   "   ! spring-boot $BOOT_VER — NOT a Chainguard -cgr build"; CGR_OK=0;;
esac
for entry in "${CHECKS[@]}"; do
  IFS='|' read -r jar floor <<<"$entry"
  ver="$(jarver "$jar")"
  if [ -z "$ver" ]; then
    red "   ! $jar — not found in BOOT-INF/lib?"; CGR_OK=0
  elif ver_lt "$ver" "$floor"; then
    red "   ! $jar $ver — still below the CVE-fix floor ($floor)"; CGR_OK=0
  else
    green "   + $jar $ver — at/above the CVE-fix floor ($floor)"
  fi
done
dim "   + spring-boot resolved from https://libraries.cgr.dev/java-remediated"
dim "   + the -cgr BOM pins the patched transitive line (Spring Fwk, Tomcat, ...)"
rule

echo
bold ">> Live exploit check: spring-web CVE-2024-22243 must be BLOCKED here"
rule
dim "   Runs the SAME exploit validate-vuln.sh uses, against this image's spring-web."
dim "   It feeds a crafted URL to UriComponentsBuilder and checks getHost():"
dim "       https://trusted.example.com[@evil.com/redirect"
dim "   A conforming client connects to evil.com (everything before '@' is userinfo)."
dim "   On the remediated spring-web the parser must agree: getHost() should return"
dim "   \"evil.com\", so a host allow-list correctly REJECTS it (no bypass)."
dim "   BLOCKED = getHost()==evil (allow-list rejects);  VULNERABLE = getHost()==trusted."
rule
JDK_IMAGE="cgr.dev/mikeco.com/jdk:17-dev"
PROBE="$(cd "$(dirname "$0")" && pwd)/UriBypassProbe.java"
FIX_HOLDS=0
if [ ! -f "$PROBE" ]; then
  red "   probe not found: $PROBE"
else
  WORK="$(mktemp -d)"
  docker cp -q "$CT:/app/app.jar" "$WORK/app.jar"
  ( cd "$WORK" && unzip -oq app.jar 'BOOT-INF/lib/spring-web-*.jar' 'BOOT-INF/lib/spring-core-*.jar' 'BOOT-INF/lib/spring-jcl-*.jar' \
      && mkdir -p lib && mv BOOT-INF/lib/*.jar lib/ && rm -rf BOOT-INF )
  cp "$PROBE" "$WORK/UriBypassProbe.java"
  set +e
  OUT="$(docker run --rm -v "$WORK:/w" -w /w "$JDK_IMAGE" \
        sh -c 'javac -cp "lib/*" UriBypassProbe.java && java -cp "lib/*:." UriBypassProbe' 2>&1)"; RC=$?
  set -e
  rm -rf "$WORK"
  printf '%s\n' "$OUT" | sed 's/^/   /'
  if [ "$RC" = "1" ]; then
    green "   => fix holds: the host-parsing bypass was rejected on the remediated spring-web"; FIX_HOLDS=1
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
[ "$CGR_OK" = "1" ] || { red "FAIL: not every CVE-relevant jar is remediated."; PASS=0; }
[ "$FIX_HOLDS" = "1" ] || { red "FAIL: the CVE-2024-22243 exploit was not confirmed blocked on this image."; PASS=0; }

if [ "$PASS" = "1" ]; then
  green "FIXED: the Chainguard-extended 3.2 line replaces the EOL vulnerable jars, the app still serves,"
  green "and the spring-web CVE-2024-22243 host-parsing bypass is no longer exploitable."
  dim "Confirm the CVE delta with:  grype $IMG   (compare against grype java-app:vulnerable)"
  exit 0
else
  exit 1
fi
