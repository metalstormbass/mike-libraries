#!/usr/bin/env bash
# Compare js/ and cg_js/ — two-column view of what files changed.
set -euo pipefail
cd "$(dirname "$0")"

DIR1="js"
DIR2="cg_js"
SKIP="node_modules|package-lock.json"

# Collect files from both dirs
files=$({ ls -1A "$DIR1" 2>/dev/null; ls -1A "$DIR2" 2>/dev/null; } | grep -Ev "^($SKIP)$" | sort -u)

# Colors
R='\033[0;31m' G='\033[0;32m' Y='\033[0;33m' D='\033[2m' B='\033[1m' N='\033[0m'

printf "\n  ${B}%-25s  %s${N}\n" "$DIR1/" "$DIR2/"
printf "  %-25s  %s\n" "-------------------------" "-------------------------"

for f in $files; do
    in1="$DIR1/$f" in2="$DIR2/$f"
    if [[ ! -e "$in1" ]]; then
        printf "  ${D}%-25s${N}  ${Y}%s${N}\n" "—" "$f"
    elif [[ ! -e "$in2" ]]; then
        printf "  ${Y}%-25s${N}  ${D}%s${N}\n" "$f" "—"
    elif diff -q "$in1" "$in2" > /dev/null 2>&1; then
        printf "  ${G}%-25s${N}  ${G}%s${N}\n" "$f" "$f"
    else
        printf "  ${R}%-25s${N}  ${R}%s${N}\n" "$f *" "$f *"
    fi
done

echo ""
printf "  ${G}green${N} = identical  ${R}red *${N} = changed  ${Y}yellow${N} = missing\n\n"
