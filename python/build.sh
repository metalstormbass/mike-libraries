#!/bin/bash
set -euo pipefail

# Builds this application into two containers:
#   python-app:vulnerable — deps from public PyPI, pinned to versions with known CVEs
#   python-app:fixed      — deps from Chainguard Libraries, with CGR-backported CVE
#                           patches (+cgr.N from the python-remediated index) and
#                           malware-blocklist-enforced packages
#
# After building, the containers are started so the validate scripts can run:
#   python-app-vulnerable — http://localhost:5001
#   python-app-fixed      — http://localhost:5002
#
# Usage: ./build.sh [vulnerable|fixed|all]   (default: all)

IDENTITY="a8cae4933a02f321aab564b94317461940499c01_8cd8908c6e3b3171"
TOKEN="eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJodHRwczovL2lzc3Vlci5lbmZvcmNlLmRldiIsImV4cCI6MTc5MDQ1NTExNywiaWF0IjoxNzU4OTE5MTE4LCJpc3MiOiJodHRwczovL3B1bGx0b2tlbi5pc3N1ZXIuY2hhaW5ndWFyZC5kZXYiLCJzdWIiOiJwdWxsLXRva2VuLTExZjMyYzBlMDM5YmEwZDllOTQ0MDVkNDM1OWFmYjZlNDdmOGY4ZjQifQ.fUNWpCkmHe0RMRDlpqBRGbYga4r_2CBPTSCF1U1Ryg3rEOv7eceA3CZ0XalRkrIABAYDCpG7no1Hk9vdCWgERPynRT7_he766Kh4giCDoPpiRK9hUtw8tzak6xN3sNH8W5Ws6v2Y3tehdxVc31ecEai-9H3s_Bbp2sMJlldja_CO3qrjj0PWMeYFD-wlUU5r7P2ZqJqnIYr7a_SnlCXhZBqzxxDhbMZit3NA89wZGIuBEMpYG7EepULTnUi-aMqzq4rz7AASliifea3tiSPsJH2XlKxtoAt-vK8nYjrhB7-x3pqYfgV3JFrIMRggaqzdC1IZnoXs1pnNDf_M34WFcaYCXo9np1gE5f2Kd1g5I6yIPj7fL7jrTM243-WceAlbPdUI1FAoctNPOeBvQaFdb3fwmkQ0cwV6prEzSgKq2SoLxhswrtqRV20gerChiBg3-rPIkw7qSgBrQ2IhZSSy3m36jOsoalOk2Mp2_zapqJxV3N0v5VxU-RRwNiNy86wCPcxo37Q28eWncdR9IGITNAAc3TOAQ7ygVwMX1cyiess5nJE-v7T3lEQxBZr8SVBmgiOqXCyYBPJT4qRMy2_hhhK60TahXt0Pnq_0PdDVH-PKIHVSReGhiaNiBHoUJUp1oBeiwx0trYdGoVtgH80tRyEAANo-PokaahRyI-UjYMw"
INDEX_HOST="libraries.cgr.dev"
CGR_INDEX_URL="https://${IDENTITY}:${TOKEN}@${INDEX_HOST}/python/simple/"
CGR_REMEDIATED_URL="https://${IDENTITY}:${TOKEN}@${INDEX_HOST}/python-remediated/simple/"
PYPI_INDEX_URL="https://pypi.org/simple/"

validate_token() {
    echo "Validating pull token..."

    # Check the JWT expiry claim locally before hitting the network
    local payload exp now
    payload=$(printf '%s' "${TOKEN}" | cut -d. -f2 | tr '_-' '/+')
    case $(( ${#payload} % 4 )) in
        2) payload="${payload}==" ;;
        3) payload="${payload}=" ;;
    esac
    exp=$(printf '%s' "${payload}" | base64 -d 2>/dev/null | sed -n 's/.*"exp":\([0-9]*\).*/\1/p')
    now=$(date +%s)

    if [[ -z "${exp}" ]]; then
        echo "ERROR: could not decode token expiry; token may be malformed" >&2
        exit 1
    fi
    if (( now >= exp )); then
        echo "ERROR: pull token expired on $(date -r "${exp}")" >&2
        echo "Generate a new one with: chainctl auth pull-token create --repository=python" >&2
        exit 1
    fi
    echo "Token expires $(date -r "${exp}")"

    # Confirm the registry accepts the token on both indexes the fixed build uses
    local path status
    for path in "python/simple/" "python-remediated/simple/aiohttp/"; do
        status=$(curl -sS -o /dev/null -w '%{http_code}' \
            -u "${IDENTITY}:${TOKEN}" \
            "https://${INDEX_HOST}/${path}")
        if [[ "${status}" != "200" ]]; then
            echo "ERROR: ${INDEX_HOST}/${path} rejected the pull token (HTTP ${status})" >&2
            exit 1
        fi
    done
    echo "Token accepted by ${INDEX_HOST} (python + python-remediated)"
}

build_vulnerable() {
    echo ""
    echo "==> Building python-app:vulnerable (public PyPI, known-CVE pins)"
    docker build \
        --build-arg PIP_INDEX_URL="${PYPI_INDEX_URL}" \
        --build-arg REQUIREMENTS=requirements.txt \
        -t python-app:vulnerable .
}

build_fixed() {
    echo ""
    echo "==> Building python-app:fixed (Chainguard Libraries + remediated +cgr.N patches)"
    docker build \
        --build-arg PIP_INDEX_URL="${CGR_INDEX_URL}" \
        --build-arg PIP_EXTRA_INDEX_URL="${CGR_REMEDIATED_URL}" \
        --build-arg REQUIREMENTS=requirements-fixed.txt \
        -t python-app:fixed .
}

run_container() {
    local tag="$1" port="$2"
    local name="python-app-${tag}"
    echo ""
    echo "==> Starting ${name} on http://localhost:${port}"
    docker rm -f "${name}" >/dev/null 2>&1 || true
    docker run -d --rm --name "${name}" -p "${port}:5000" "python-app:${tag}" >/dev/null
    for _ in $(seq 1 40); do
        if curl -fsS -o /dev/null "http://localhost:${port}/health" 2>/dev/null; then
            echo "    ${name} is healthy"
            return 0
        fi
        sleep 0.5
    done
    echo "WARNING: ${name} did not respond on /health within 20s" >&2
    docker logs "${name}" 2>&1 | tail -5 >&2 || true
}

show_versions() {
    local tag="$1"
    if docker image inspect "python-app:${tag}" >/dev/null 2>&1; then
        echo ""
        echo "--- python-app:${tag} — backport-relevant packages ---"
        docker run --rm --entrypoint pip "python-app:${tag}" freeze 2>/dev/null \
            | grep -iE '^(aiohttp|pillow|python-multipart|requests)=='
    fi
}

TARGET="${1:-all}"

case "${TARGET}" in
    vulnerable)
        build_vulnerable
        ;;
    fixed)
        validate_token
        build_fixed
        ;;
    all)
        validate_token
        build_vulnerable
        build_fixed
        ;;
    *)
        echo "Usage: $0 [vulnerable|fixed|all]" >&2
        exit 1
        ;;
esac

echo ""
echo "==> Build complete"
[[ "${TARGET}" == "vulnerable" || "${TARGET}" == "all" ]] && show_versions vulnerable
[[ "${TARGET}" == "fixed" || "${TARGET}" == "all" ]] && show_versions fixed

[[ "${TARGET}" == "vulnerable" || "${TARGET}" == "all" ]] && run_container vulnerable 5001
[[ "${TARGET}" == "fixed" || "${TARGET}" == "all" ]] && run_container fixed 5002

echo ""
echo "==> Containers running — validate with: ./validate-vuln.sh ; ./validate-fixed.sh"
echo "Compare CVEs with: grype python-app:vulnerable ; grype python-app:fixed"
