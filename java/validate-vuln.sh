#!/usr/bin/env bash
#
# validate-vuln.sh — Demonstrate that the UPSTREAM build ships the EOL Spring
# Boot 3.2.1 dependency line straight from public Maven Central, with known CVEs.
#
# Boots java-app:vulnerable, confirms the Spring Boot app serves, inspects the
# key jars in BOOT-INF/lib against the version that fixes their known CVEs (e.g.
# spring-web 6.1.2 < 6.1.4 → CVE-2024-22243, tomcat-embed-core 10.1.17 < 10.1.19
# → CVE-2024-24549), then ACTIVELY EXPLOITS spring-web CVE-2024-22243: it feeds a
# crafted URL through the shipped UriComponentsBuilder and shows a host allow-list
# is bypassed. Expected outcome: plain EOL pins, and the bypass succeeds.
#
# Prereq: ./build.sh vulnerable   (builds java-app:vulnerable)
#
# Usage:
#   ./validate-vuln.sh
#
set -euo pipefail

IMG=java-app:vulnerable
CT=java-app-vulnerable
PORT=8081
HOST="http://localhost:$PORT"

# jar | first version fixing its CVEs | CVEs present on the vulnerable pin
CHECKS=(
  "spring-boot|3.2.9|CVE-2024-38807 (loader signed-jar spoofing); OSS 3.2 line is EOL"
  "spring-web|6.1.4|CVE-2024-22243/-22259/-22262 (UriComponentsBuilder open redirect / SSRF)"
  "spring-webmvc|6.1.14|CVE-2024-38819 (WebMvc.fn path traversal)"
  "spring-security-core|6.2.2|CVE-2024-22234 (AuthenticationTrustResolver access-control bypass)"
  "tomcat-embed-core|10.1.19|CVE-2024-24549 (HTTP/2 DoS), CVE-2024-23672 (WebSocket DoS)"
)

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
bold " VULNERABLE build — EOL Spring Boot 3.2.1 line from Maven Central"
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
bold ">> Baseline: the app serves normally"
rule
for p in "/api/health" "/api/items"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HOST$p")"
  printf "   GET %-18s -> HTTP %s\n" "$p" "$code"
done
rule

echo
bold ">> Resolved versions of the CVE-relevant jars in BOOT-INF/lib"
rule
VULN=0
for entry in "${CHECKS[@]}"; do
  IFS='|' read -r jar floor cves <<<"$entry"
  ver="$(jarver "$jar")"
  case "$ver" in
    "")      red   "   $jar — not found in BOOT-INF/lib?";;
    *cgr*)   green "   $jar $ver — Chainguard -cgr build (unexpected in the vulnerable image)";;
    *)
      if ver_lt "$ver" "$floor"; then
        red "   $jar $ver — < $floor: $cves"; VULN=1
      else
        green "   $jar $ver — at/above the CVE-fix floor ($floor)"
      fi;;
  esac
done
rule

echo
bold ">> Live exploit: spring-web CVE-2024-22243 (UriComponentsBuilder host bypass)"
rule
dim "   Reproduces a common real-world pattern: an app parses an attacker-supplied"
dim "   URL, allow-lists it by getHost(), then uses the URL for a redirect / server-"
dim "   side request. The probe feeds this crafted URL to the shipped spring-web:"
dim "       https://trusted.example.com[@evil.com/redirect"
dim "   A spec-conforming client treats everything before '@' as userinfo, so it"
dim "   really connects to evil.com. But on spring-web < 6.1.4 the '[' derails the"
dim "   host parser and getHost() returns \"trusted.example.com\" — so a host allow-"
dim "   list is fooled into approving a URL that actually points at evil.com."
dim "   VULNERABLE = getHost()==trusted (allow-list bypassed);  BLOCKED = getHost()==evil."
rule
# The runtime image is a JRE (no javac); compile+run the probe against the exact
# spring-web jar shipped in this image, using the project's JDK image.
JDK_IMAGE="cgr.dev/mikeco.com/jdk:17-dev"
PROBE="$(cd "$(dirname "$0")" && pwd)/UriBypassProbe.java"
EXPLOITED=0
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
  if [ "$RC" = "0" ]; then
    red   "   => EXPLOIT SUCCEEDED: the shipped spring-web is actually vulnerable"; EXPLOITED=1
  elif [ "$RC" = "1" ]; then
    green "   => exploit blocked (unexpected in the vulnerable build)"
  else
    red   "   => probe error (could not determine exploitability)"
  fi
fi
rule

echo
bold "==================== VERDICT ===================="
if [ "$VULN" = "1" ] && [ "$EXPLOITED" = "1" ]; then
  red "VULNERABLE: this image ships the EOL Spring Boot 3.2.1 line from Maven Central"
  red "and the spring-web CVE-2024-22243 host-parsing bypass is exploitable on it."
  dim "Confirm the full CVE inventory with:  grype $IMG"
  exit 0
elif [ "$VULN" = "1" ]; then
  red "VULNERABLE (by version): known-CVE jars are present, but the CVE-2024-22243"
  red "probe did not confirm exploitation — see above."
  dim "Confirm the full CVE inventory with:  grype $IMG"
  exit 0
else
  green "No vulnerable upstream pins detected — this may already be a remediated image."
  exit 1
fi
