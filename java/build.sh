#!/bin/bash
set -euo pipefail

# Builds this application into two containers:
#   java-app:vulnerable — deps from public Maven Central, Spring Boot 3.2.1
#                         (EOL 3.2 line with known CVEs)
#   java-app:fixed      — deps from Chainguard Libraries Java, Spring Boot
#                         3.2.12-0.cgr.1 (Chainguard-extended 3.2 line with
#                         backported CVE patches) plus malware-blocklist-
#                         enforced resolution through libraries.cgr.dev
#
# After building, the containers are started so the validate scripts can run:
#   java-app-vulnerable — http://localhost:8081
#   java-app-fixed      — http://localhost:8082
#
# Usage: ./build.sh [vulnerable|fixed|all]   (default: all)

cd "$(dirname "$0")"

set -a
# shellcheck disable=SC1091
source .env
set +a

SPRING_BOOT_VULNERABLE="3.2.1"
SPRING_BOOT_FIXED="3.2.12-0.cgr.1"

validate_creds() {
    echo "Validating Chainguard Libraries credentials and remediated artifacts..."
    local path status
    for path in \
        "org/springframework/boot/spring-boot-dependencies/${SPRING_BOOT_FIXED}/spring-boot-dependencies-${SPRING_BOOT_FIXED}.pom" \
        "org/springframework/boot/spring-boot/${SPRING_BOOT_FIXED}/spring-boot-${SPRING_BOOT_FIXED}.jar"; do
        status=$(curl -sSL -o /dev/null -w '%{http_code}' \
            -u "${MAVEN_USERNAME}:${MAVEN_PASSWORD}" \
            "https://libraries.cgr.dev/java-remediated/${path}")
        if [[ "${status}" != "200" ]]; then
            echo "ERROR: HTTP ${status} for libraries.cgr.dev/java-remediated/${path}" >&2
            echo "Check MAVEN_USERNAME/MAVEN_PASSWORD in .env (chainctl auth pull-token create --repository=java)" >&2
            exit 1
        fi
    done
    echo "Credentials accepted; Spring Boot ${SPRING_BOOT_FIXED} artifacts present"
}

build_vulnerable() {
    echo ""
    echo "==> Building java-app:vulnerable (Maven Central, Spring Boot ${SPRING_BOOT_VULNERABLE})"
    docker build \
        --build-arg SETTINGS_FILE=settings-registry1.xml \
        --build-arg SPRING_BOOT_VERSION="${SPRING_BOOT_VULNERABLE}" \
        -t java-app:vulnerable .
}

build_fixed() {
    echo ""
    echo "==> Building java-app:fixed (Chainguard Libraries, Spring Boot ${SPRING_BOOT_FIXED})"
    docker build \
        --build-arg MAVEN_USERNAME="${MAVEN_USERNAME}" \
        --build-arg MAVEN_PASSWORD="${MAVEN_PASSWORD}" \
        --build-arg SETTINGS_FILE=settings.xml \
        --build-arg SPRING_BOOT_VERSION="${SPRING_BOOT_FIXED}" \
        -t java-app:fixed .
}

run_container() {
    local tag="$1" port="$2"
    local name="java-app-${tag}"
    echo ""
    echo "==> Starting ${name} on http://localhost:${port}"
    docker rm -f "${name}" >/dev/null 2>&1 || true
    docker run -d --rm --name "${name}" -p "${port}:8080" "java-app:${tag}" >/dev/null
    for _ in $(seq 1 120); do
        if curl -fsS -o /dev/null "http://localhost:${port}/api/health" 2>/dev/null; then
            echo "    ${name} is healthy"
            return 0
        fi
        sleep 0.5
    done
    echo "WARNING: ${name} did not respond on /api/health within 60s" >&2
    docker logs "${name}" 2>&1 | tail -5 >&2 || true
}

show_versions() {
    local tag="$1"
    if docker image inspect "java-app:${tag}" >/dev/null 2>&1; then
        echo ""
        echo "--- java-app:${tag} — key Spring jars in BOOT-INF/lib ---"
        local cid tmp
        cid=$(docker create "java-app:${tag}")
        tmp=$(mktemp -d)
        docker cp -q "${cid}:/app/app.jar" "${tmp}/app.jar"
        docker rm "${cid}" >/dev/null
        unzip -l "${tmp}/app.jar" \
            | grep -oE 'BOOT-INF/lib/(spring-boot|spring-web|spring-webmvc|spring-core|spring-security-core|tomcat-embed-core)-[0-9][^ ]*\.jar' \
            | sed 's|BOOT-INF/lib/||' | sort
        rm -rf "${tmp}"
    fi
}

TARGET="${1:-all}"

case "${TARGET}" in
    vulnerable)
        build_vulnerable
        ;;
    fixed)
        validate_creds
        build_fixed
        ;;
    all)
        validate_creds
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

[[ "${TARGET}" == "vulnerable" || "${TARGET}" == "all" ]] && run_container vulnerable 8081
[[ "${TARGET}" == "fixed" || "${TARGET}" == "all" ]] && run_container fixed 8082

echo ""
echo "==> Containers running — validate with: ./validate-vuln.sh ; ./validate-fixed.sh"
echo "Compare CVEs with: grype java-app:vulnerable ; grype java-app:fixed"
