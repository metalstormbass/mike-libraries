# Registry Switching Guide

This guide explains how to toggle between **public package registries** (PyPI, npmjs.com, Maven Central) and **private/custom registries** for Python, JavaScript, and Java applications.

## Overview

Each language has two sets of configuration files:
- **Registry 1 (Public)**: Uses public registries - PyPI, npmjs.com, and Maven Central (no authentication required)
- **Registry 2 (Private)**: Uses your private/custom registries with authentication

## Configuration Files

### Python
- `.env.registry1` - Public PyPI configuration (no credentials needed)
- `.env.registry2` - Private registry configuration (requires credentials)
- `pip.conf.registry1` - Public PyPI pip config
- `pip.conf.registry2` - Private registry pip config

### JavaScript
- `.env.registry1` - Public npm configuration (no credentials needed)
- `.env.registry2` - Private registry configuration (requires credentials)
- `.npmrc.registry1` - Public npm config
- `.npmrc.registry2` - Private registry npm config

### Java
- `.env.registry1` - Public Maven Central configuration (no credentials needed)
- `.env.registry2` - Private registry configuration (requires credentials)
- `settings-registry1.xml` - Minimal settings for public Maven Central
- `settings-registry2.xml` - Private registry Maven settings

## Quick Start

### Method 1: Using the Switch Script (Recommended)

The easiest way to switch between public and private registries:

```bash
# Switch to Public Registries (PyPI, npmjs.com, Maven Central)
./switch-registry.sh public

# Switch to Private Registries
./switch-registry.sh private
```

Legacy commands (also supported):
```bash
./switch-registry.sh registry1  # Same as 'public'
./switch-registry.sh registry2  # Same as 'private'
```

This script automatically:
1. Copies the appropriate config files for all three languages
2. Creates active `.env`, `pip.conf`, `.npmrc`, and `settings.xml` files
3. Displays which registries are now active

After switching, rebuild your containers:
```bash
docker-compose up -d --build
```

### Method 2: Manual Configuration

You can also manually copy the configuration files:

#### Python
```bash
# Use Public PyPI
cp python/.env.registry1 python/.env
cp python/pip.conf.registry1 python/pip.conf

# Use Private Registry
cp python/.env.registry2 python/.env
cp python/pip.conf.registry2 python/pip.conf
```

#### JavaScript
```bash
# Use Public npm
cp javascript/.env.registry1 javascript/.env
cp javascript/.npmrc.registry1 javascript/.npmrc

# Use Private Registry
cp javascript/.env.registry2 javascript/.env
cp javascript/.npmrc.registry2 javascript/.npmrc
```

#### Java
```bash
# Use Public Maven Central
cp java/.env.registry1 java/.env
cp java/settings-registry1.xml java/settings.xml

# Use Private Registry
cp java/.env.registry2 java/.env
cp java/settings-registry2.xml java/settings.xml
```

## Configuration Setup

### Public Registries (Registry 1)

The public registry configuration files are **ready to use** with no modifications needed. They point to:
- Python: https://pypi.org
- JavaScript: https://registry.npmjs.org
- Java: Maven Central (https://repo.maven.apache.org/maven2)

No authentication credentials are required.

### Private Registries (Registry 2)

Before using private registries, you must edit the registry2 configuration files with your actual credentials.

#### Python: `python/.env.registry2`
```bash
# Edit this file
nano python/.env.registry2

# Update with your private registry details
PIP_INDEX_URL=https://your-username:your-password@your-private-pypi.com/simple/
PYPI_USERNAME=your-actual-username
PYPI_PASSWORD=your-actual-password
```

Also update `python/pip.conf.registry2` with your registry URL.

#### JavaScript: `javascript/.env.registry2`
```bash
# Edit this file
nano javascript/.env.registry2

# Update with your private registry details
NPM_TOKEN=your-actual-npm-token
NPM_REGISTRY=https://your-npm-registry.com/
```

Also update `javascript/.npmrc.registry2` with your registry domain and ensure the authentication token path matches.

#### Java: `java/.env.registry2`
```bash
# Edit this file
nano java/.env.registry2

# Update with your private registry details
MAVEN_USERNAME=your-actual-username
MAVEN_PASSWORD=your-actual-password
```

Also update `java/settings-registry2.xml`:
- Replace `https://maven.private.example.com` with your actual Maven repository URLs
- Update repository IDs if needed
- Uncomment mirror configuration if you want to route Maven Central through your private repo

## Usage Examples

### Switching for Development vs Production

```bash
# Development: Use public registries (free, no setup)
./switch-registry.sh public
docker-compose up -d --build

# Production: Use private registries (controlled, internal packages)
./switch-registry.sh private
docker-compose up -d --build
```

### Local Development

#### Python
```bash
# Switch to public PyPI
./switch-registry.sh public
cd python
pip install -r requirements.txt

# Or switch to private
./switch-registry.sh private
cd python
source .env  # Load private registry credentials
pip install -r requirements.txt
```

#### JavaScript
```bash
# Switch to public npm
./switch-registry.sh public
cd javascript
npm install

# Or switch to private
./switch-registry.sh private
cd javascript
npm install
```

#### Java
```bash
# Switch to public Maven Central
./switch-registry.sh public
cd java
mvn clean install

# Or switch to private
./switch-registry.sh private
cd java
mvn -s settings.xml clean install
```

### CI/CD Integration

In your CI/CD pipeline:

```yaml
# .github/workflows/build.yml
steps:
  - name: Checkout code
    uses: actions/checkout@v2

  - name: Switch to private registry
    run: ./switch-registry.sh private

  - name: Set up credentials
    run: |
      echo "NPM_TOKEN=${{ secrets.NPM_TOKEN }}" >> javascript/.env
      echo "MAVEN_USERNAME=${{ secrets.MAVEN_USERNAME }}" >> java/.env
      echo "MAVEN_PASSWORD=${{ secrets.MAVEN_PASSWORD }}" >> java/.env

  - name: Build containers
    run: docker-compose up -d --build
```

## Testing Registry Connectivity

### Python
```bash
# Test public PyPI
pip install --index-url https://pypi.org/simple/ requests

# Test private registry
pip install --index-url https://your-private-pypi.com/simple/ your-package

# Verbose output for debugging
pip install -v package-name
```

### JavaScript
```bash
# Test public npm
npm whoami --registry https://registry.npmjs.org/

# Test private registry
npm whoami --registry https://your-npm-registry.com/

# Test package access
npm view package-name
```

### Java
```bash
# Test Maven Central (public)
mvn dependency:get -Dartifact=org.springframework.boot:spring-boot:3.2.0

# Test private registry
mvn -s settings.xml dependency:get -Dartifact=com.yourcompany:your-artifact:1.0.0

# Verbose output
mvn -s settings.xml -X clean install
```

## Common Use Cases

### Use Case 1: Open Source Project

```bash
# Develop with public registries
./switch-registry.sh public
docker-compose up -d --build
```

All dependencies come from public sources. No credentials needed.

### Use Case 2: Enterprise Project with Internal Libraries

```bash
# Use private registry for internal packages
./switch-registry.sh private
docker-compose up -d --build
```

Your private registry can:
- Host proprietary internal packages
- Cache/proxy public packages (for reliability)
- Scan packages for security vulnerabilities

### Use Case 3: Hybrid Approach

Edit `.env.registry2` files to use both:

```bash
# Python pip.conf.registry2
[global]
index-url = https://your-private-pypi.com/simple/
extra-index-url = https://pypi.org/simple/  # Fallback to public
```

This configuration:
1. Checks your private registry first
2. Falls back to public PyPI if package not found

## Security Best Practices

### 1. Never Commit Active Credentials

The `.gitignore` file protects active config files:
```gitignore
python/.env
javascript/.env
java/.env
python/pip.conf
javascript/.npmrc
java/settings.xml
```

Template files (`.env.registry1`, `.env.registry2`) can be committed **only if they contain placeholders**, not real credentials.

### 2. Use Environment Variables

All private registry configs use environment variables like `${NPM_TOKEN}` to avoid hardcoding credentials.

### 3. Rotate Credentials Regularly

Update the `.env.registry2` files periodically with new tokens/passwords.

### 4. Separate Development and Production Credentials

- Development: May use relaxed credentials or public registries
- Production: Should use restricted credentials with minimal permissions

## Troubleshooting

### Script Permission Denied
```bash
chmod +x switch-registry.sh
```

### "Cannot find .env.registry1 file"
Make sure you're running the script from the project root directory.

### Public Registry Not Working After Switch
```bash
# Verify you switched correctly
./switch-registry.sh public

# Check active config
cat python/.env
cat javascript/.npmrc
cat java/settings.xml
```

### Private Registry Authentication Failed

1. **Verify credentials:**
```bash
# Check your .env.registry2 files have been edited
cat python/.env.registry2
cat javascript/.env.registry2
cat java/.env.registry2
```

2. **Test connectivity:**
```bash
# Python
pip install --index-url https://your-url/simple/ requests -v

# JavaScript
npm whoami --registry https://your-registry/

# Java
mvn -s settings.xml -X dependency:resolve
```

3. **Check URLs:**
Ensure URLs in config files match your actual private registry endpoints.

## File Structure

```
mike-libraries/
├── switch-registry.sh                # Registry switcher script
├── docker-compose.yml                # Configured for registry switching
├── .gitignore                        # Protects active credential files
│
├── python/
│   ├── .env.registry1                # Public PyPI (ready to use)
│   ├── .env.registry2                # Private registry (needs credentials)
│   ├── pip.conf.registry1            # Public PyPI config
│   ├── pip.conf.registry2            # Private registry config
│   ├── .env                          # Active config (created by script, git-ignored)
│   └── pip.conf                      # Active config (created by script, git-ignored)
│
├── javascript/
│   ├── .env.registry1                # Public npm (ready to use)
│   ├── .env.registry2                # Private registry (needs credentials)
│   ├── .npmrc.registry1              # Public npm config
│   ├── .npmrc.registry2              # Private registry config
│   ├── .env                          # Active config (created by script, git-ignored)
│   └── .npmrc                        # Active config (created by script, git-ignored)
│
└── java/
    ├── .env.registry1                # Public Maven Central (ready to use)
    ├── .env.registry2                # Private registry (needs credentials)
    ├── settings-registry1.xml        # Minimal Maven settings for public
    ├── settings-registry2.xml        # Private registry Maven settings
    ├── .env                          # Active config (created by script, git-ignored)
    └── settings.xml                  # Active config (created by script, git-ignored)
```

## Advanced Configuration

### Private Registry with Public Fallback

For private registries, you can configure fallback to public registries:

**Python (`pip.conf.registry2`):**
```ini
[global]
index-url = https://your-private-pypi.com/simple/
extra-index-url = https://pypi.org/simple/
```

**JavaScript (`.npmrc.registry2`):**
```
registry=https://your-npm-registry.com/
# For packages not in private registry, uncomment:
# @public:registry=https://registry.npmjs.org/
```

**Java (`settings-registry2.xml`):**
```xml
<repositories>
  <repository>
    <id>private-releases</id>
    <url>https://maven.private.example.com/repository/releases/</url>
  </repository>
  <!-- Keep Maven Central accessible -->
  <repository>
    <id>central</id>
    <url>https://repo.maven.apache.org/maven2</url>
  </repository>
</repositories>
```

### Mirror Public Registries Through Private

Some organizations mirror public registries through their private infrastructure for:
- Security scanning
- Availability/reliability
- Bandwidth optimization

Edit `java/settings-registry2.xml` and uncomment the mirror sections.

## Summary

The registry switching system provides:
- ✅ Easy toggling between public and private registries
- ✅ Public registries work out-of-the-box (no setup required)
- ✅ Private registries support all major registry types
- ✅ Consistent approach across Python, JavaScript, and Java
- ✅ Docker Compose integration
- ✅ CI/CD ready with secrets management
- ✅ No hardcoded credentials

## Quick Reference

```bash
# Switch to public registries (no credentials needed)
./switch-registry.sh public

# Switch to private registries (credentials required)
./switch-registry.sh private

# Rebuild containers after switching
docker-compose up -d --build

# Check current configuration
cat python/.env | head -1
cat javascript/.npmrc | head -1
cat java/settings.xml | head -2
```

For more details on authentication setup, see [AUTHENTICATION.md](AUTHENTICATION.md).
