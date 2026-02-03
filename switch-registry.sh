#!/bin/bash

# Registry Switcher Script
# Switches between public registries (PyPI, npmjs.com, Maven Central) and Chainguard private registries
# Usage: ./switch-registry.sh [--original|--cgr|public|private]

set -e

REGISTRY=${1:-registry1}

# Support multiple naming conventions for registry selection
case "$REGISTRY" in
    --original|public|registry1)
        REGISTRY="registry1"
        DISPLAY_NAME="Public Registries (PyPI, npmjs.com, Maven Central)"
        ;;
    --cgr|private|registry2)
        REGISTRY="registry2"
        DISPLAY_NAME="Chainguard Libraries (libraries.cgr.dev)"
        ;;
    *)
        echo "Error: Invalid registry option"
        echo "Usage: ./switch-registry.sh [--original|--cgr]"
        echo ""
        echo "Options:"
        echo "  --original  - Use public registries (PyPI, npmjs.com, Maven Central)"
        echo "  --cgr       - Use Chainguard Libraries (libraries.cgr.dev)"
        echo ""
        echo "Legacy options: [public|private] or [registry1|registry2] also work"
        exit 1
        ;;
esac

echo "🔄 Switching to $DISPLAY_NAME..."
echo ""

# Python
echo "📦 Python Configuration:"
if [ -f "python/.env.$REGISTRY" ]; then
    cp "python/.env.$REGISTRY" "python/.env"
    echo "  ✓ Copied python/.env.$REGISTRY to python/.env"
fi

if [ -f "python/pip.conf.$REGISTRY" ]; then
    cp "python/pip.conf.$REGISTRY" "python/pip.conf"
    echo "  ✓ Copied python/pip.conf.$REGISTRY to python/pip.conf"
fi

# JavaScript
echo ""
echo "📦 JavaScript Configuration:"
if [ -f "javascript/.env.$REGISTRY" ]; then
    cp "javascript/.env.$REGISTRY" "javascript/.env"
    echo "  ✓ Copied javascript/.env.$REGISTRY to javascript/.env"
fi

if [ -f "javascript/.npmrc.$REGISTRY" ]; then
    cp "javascript/.npmrc.$REGISTRY" "javascript/.npmrc"
    echo "  ✓ Copied javascript/.npmrc.$REGISTRY to javascript/.npmrc"
fi

# Java
echo ""
echo "📦 Java Configuration:"
if [ -f "java/.env.$REGISTRY" ]; then
    cp "java/.env.$REGISTRY" "java/.env"
    echo "  ✓ Copied java/.env.$REGISTRY to java/.env"
fi

if [ -f "java/settings-$REGISTRY.xml" ]; then
    cp "java/settings-$REGISTRY.xml" "java/settings.xml"
    echo "  ✓ Copied java/settings-$REGISTRY.xml to java/settings.xml"
fi

echo ""
echo "✅ Successfully switched to $DISPLAY_NAME!"
echo ""

if [ "$REGISTRY" = "registry1" ]; then
    echo "Now using public registries (configured in .env.registry1 files):"
    echo "  • Python: https://pypi.org (public PyPI)"
    echo "  • JavaScript: https://registry.npmjs.org (public npm)"
    echo "  • Java: Maven Central (public)"
else
    echo "Now using Chainguard Libraries (configured in .env.registry2 files):"
    echo "  • Python: libraries.cgr.dev/python → libraries.cgr.dev/python-remediated (Chainguard only)"
    echo "  • JavaScript: libraries.cgr.dev/javascript (Chainguard only)"
    echo "  • Java: libraries.cgr.dev/java (Chainguard only)"
    echo ""
    echo "All authentication credentials are configured in the .env files."
    echo ""
    echo "Note: No public registry fallbacks configured - all dependencies must be available in Chainguard Libraries."
fi

echo ""
echo "Next steps:"
echo "  1. Force rebuild containers (bypasses cache): docker-compose build --no-cache && docker-compose up -d"
echo "  2. Or quick rebuild with cache: docker-compose up -d --build"
echo "  3. Or run locally with the new registry configurations"
echo ""
echo "Note: All registry URLs and authentication tokens are defined in:"
echo "  • python/.env and python/pip.conf"
echo "  • javascript/.env and javascript/.npmrc"
echo "  • java/.env and java/settings.xml"
