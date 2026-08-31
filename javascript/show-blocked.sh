#!/usr/bin/env bash
# Show two blocked JavaScript packages from the Chainguard Libraries malware API,
# contrasting the two kinds of block identifier:
#
#   1. A Chainguard-only detection      -> malid is the literal "chainguard"
#   2. A package tied to a formal MAL advisory -> malid is a "MAL-YYYY-NNNN" id
#
# Data is pulled live and pretty-printed to the terminal.
set -euo pipefail
cd "$(dirname "$0")"

API="https://libraries.cgr.dev/javascript/-/api/malware"
# One Chainguard-detected block, one with a normal MAL advisory id.
PACKAGES=("nyxora" "@ebay/ui-core-react")

R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' C='\033[0;36m' M='\033[0;35m' D='\033[2m' B='\033[1m' N='\033[0m'

command -v jq   >/dev/null || { echo "jq is required"; exit 1; }
command -v curl >/dev/null || { echo "curl is required"; exit 1; }

TOKEN=$(chainctl auth token --audience=libraries.cgr.dev 2>/dev/null || true)
[[ -n "$TOKEN" ]] || { echo "Could not obtain a token. Run: chainctl auth login" >&2; exit 1; }

hr() { printf "${D}%s${N}\n" "──────────────────────────────────────────────────────────────"; }

printf "\n${B}${R}⛔ Chainguard Sentinel — Blocked JavaScript Libraries${N}\n"
printf "${D}%s${N}\n" "$API"

for pkg in "${PACKAGES[@]}"; do
    resp=$(curl -sfG "$API" --data-urlencode "package=$pkg" \
        -H "Authorization: Bearer $TOKEN") || { printf "\n${Y}! request failed for %s${N}\n" "$pkg"; continue; }

    count=$(jq -r '.total_count // 0' <<<"$resp")
    if [[ "$count" -eq 0 ]]; then
        printf "\n${G}✓ %s — not blocked${N}\n" "$pkg"
        continue
    fi

    # A real advisory id (MAL-…) if any entry has one; otherwise "chainguard".
    malid=$(jq -r 'first(.items[] | select(.malid | test("^MAL")) | .malid) // "chainguard"' <<<"$resp")

    echo ""
    printf "${B}${R}%s${N}  ${D}(%s blocked version(s))${N}\n" "$pkg" "$count"
    if [[ "$malid" == chainguard ]]; then
        printf "  ${M}● Chainguard-detected block${N} — malid ${B}chainguard${N} ${D}(no formal advisory yet)${N}\n"
    else
        printf "  ${C}● Malware advisory${N} — malid ${B}%s${N}\n" "$malid"
    fi
    hr

    # Signals: shown once, from the most detailed entry (largest reason list).
    printf "  ${D}Sentinel signals${N}\n"
    jq -r '.items | max_by((.reason // []) | length) | (.reason // [])[]' <<<"$resp" | while read -r reason; do
        case "$reason" in
            *hostile*|*malware*|*wallet*|*credential*|*harvest*|*exfil*)
                printf "    ${R}• %s${N}\n" "$reason" ;;
            *) printf "    ${Y}• %s${N}\n" "$reason" ;;
        esac
    done

    # Compact list of blocked versions (most recent first), capped for readability.
    MAX=12
    printf "\n  ${D}Blocked versions (newest first)${N}\n"
    jq -r --argjson max "$MAX" '.items | sort_by(.blocked_at) | reverse | .[0:$max] | .[] | @base64' <<<"$resp" | while read -r row; do
        get() { echo "$row" | base64 --decode | jq -r "$1"; }
        source=$(get '.source // "?"'); ver=$(get '.version // "*"')
        scope=$(get '.scope // "?"'); mid=$(get '.malid // "-"'); blocked=$(get '.blocked_at // "-"')
        case "$source" in
            chainguard) tag="${M}chainguard${N}" ;;
            osv)        tag="${C}osv       ${N}" ;;
            *)          tag="${D}${source}${N}" ;;
        esac
        printf "    [${tag}] ${C}%-14s${N} ${D}%-7s${N} ${D}%s${N}  %s\n" "$ver" "$scope" "$blocked" "$mid"
    done
    [[ "$count" -gt "$MAX" ]] && printf "    ${D}… and %s more version(s)${N}\n" "$((count - MAX))"
done

echo ""
printf "${D}malid ${M}chainguard${D} = Chainguard Sentinel detection, no advisory   ${C}MAL-…${D} = formal malware advisory id${N}\n"
