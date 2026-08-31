#!/bin/bash
set -euo pipefail

# Colors
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
BLUE='\033[34m'
RED='\033[31m'
RESET='\033[0m'

COL_WIDTH=50

# Generate plain-text lines for one lockfile into a temp file
# Args: dir label color output_file
generate_column() {
    local dir="$1"
    local label="$2"
    local color="$3"
    local outfile="$4"
    local lockfile="$dir/package-lock.json"

    if [ ! -f "$lockfile" ]; then
        echo "  $lockfile not found" > "$outfile"
        return
    fi

    node -e "
        const lock = require('./$lockfile');
        const pkg = require('./$dir/package.json');
        const deps = Object.keys(pkg.dependencies || {}).sort();
        const devDeps = Object.keys(pkg.devDependencies || {}).sort();
        const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
        const W = ${COL_WIDTH};
        const line = '─'.repeat(W);

        const lines = [];
        lines.push('');
        lines.push('  \x1b[1m${color}${label}\x1b[0m');
        lines.push('  \x1b[2m' + line + '\x1b[0m');
        lines.push('  \x1b[1mDirect Dependencies\x1b[0m');
        lines.push('  \x1b[2m' + '─'.repeat(W) + '\x1b[0m');

        for (const name of deps) {
            const key = 'node_modules/' + name;
            const info = lock.packages[key] || {};
            const ver = info.version || '?';
            const resolved = info.resolved || '';
            let registry = '';
            if (resolved.includes('libraries.cgr.dev')) registry = ' \x1b[35m[chainguard]\x1b[0m';
            else if (resolved.includes('registry.npmjs.org')) registry = ' \x1b[2m[npmjs]\x1b[0m';
            lines.push('  \x1b[36m' + pad(name, 28) + '\x1b[0m \x1b[1m' + ver + '\x1b[0m' + registry);
            if (resolved) {
                const maxW = W - 4; // 4 chars indent
                for (let i = 0; i < resolved.length; i += maxW) {
                    lines.push('    \x1b[2m' + resolved.slice(i, i + maxW) + '\x1b[0m');
                }
            }
        }

        if (devDeps.length > 0) {
            lines.push('');
            lines.push('  \x1b[1mDev Dependencies\x1b[0m');
            lines.push('  \x1b[2m' + '─'.repeat(W) + '\x1b[0m');
            for (const name of devDeps) {
                const key = 'node_modules/' + name;
                const info = lock.packages[key] || {};
                const ver = info.version || '?';
                const resolved = info.resolved || '';
                let registry = '';
                if (resolved.includes('libraries.cgr.dev')) registry = ' \x1b[35m[chainguard]\x1b[0m';
                else if (resolved.includes('registry.npmjs.org')) registry = ' \x1b[2m[npmjs]\x1b[0m';
                lines.push('  \x1b[33m' + pad(name, 28) + '\x1b[0m \x1b[1m' + ver + '\x1b[0m' + registry);
                if (resolved) {
                    const maxW = W - 4;
                    for (let i = 0; i < resolved.length; i += maxW) {
                        lines.push('    \x1b[2m' + resolved.slice(i, i + maxW) + '\x1b[0m');
                    }
                }
            }
        }

        lines.push('');
        console.log(lines.join('\n'));
    " > "$outfile"
}

# Create temp files
LEFT=$(mktemp)
RIGHT=$(mktemp)
trap 'rm -f "$LEFT" "$RIGHT"' EXIT

generate_column "js"    "Public npm"           '\x1b[32m' "$LEFT"
generate_column "cg_js" "Chainguard Libraries"  '\x1b[35m' "$RIGHT"

# Pad left column lines to fixed visible width, then merge side by side
echo ""
echo -e "${BOLD}Package Lock File Viewer — Side by Side${RESET}"
echo ""

node -e "
    const fs = require('fs');
    const leftLines = fs.readFileSync('$LEFT', 'utf8').split('\n');
    const rightLines = fs.readFileSync('$RIGHT', 'utf8').split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);
    const COL = ${COL_WIDTH} + 10; // visible width for left column
    const SEP = '  \x1b[2m│\x1b[0m  ';

    // Strip ANSI codes to measure visible length
    const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '');

    for (let i = 0; i < maxLines; i++) {
        const l = leftLines[i] || '';
        const r = rightLines[i] || '';
        const visible = strip(l).length;
        const padding = ' '.repeat(Math.max(0, COL - visible));
        console.log(l + padding + SEP + r);
    }
"

echo ""
