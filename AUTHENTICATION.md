# Private Repository Authentication Guide

This guide explains how to configure authentication for private package repositories in Python, JavaScript, and Java applications.

## Table of Contents
- [Python (pip/PyPI)](#python-pippypi)
- [JavaScript (npm)](#javascript-npm)
- [Java (Maven)](#java-maven)
- [Docker Integration](#docker-integration)
- [Environment Variables](#environment-variables)

---

## Python (pip/PyPI)

### Files Created
- `python/.pypirc` - PyPI repository configuration
- `python/pip.conf` - Pip installation configuration

### Setup Instructions

#### Option 1: Using pip.conf (Recommended for Docker)
```bash
# Install with custom config
pip install --config python/pip.conf -r requirements.txt

# Or set environment variable
export PIP_CONFIG_FILE=/path/to/pip.conf
pip install -r requirements.txt
```

#### Option 2: Using .pypirc (For publishing packages)
```bash
# Copy to home directory
cp python/.pypirc ~/.pypirc

# Or use environment variable
export PYPIRC=/path/to/.pypirc
```

#### Option 3: Using environment variables
```bash
export PIP_INDEX_URL="https://username:password@private-pypi.example.com/simple/"
export PIP_EXTRA_INDEX_URL="https://pypi.org/simple/"
pip install -r requirements.txt
```

### Configuration Steps
1. Edit `python/pip.conf` or `python/.pypirc`
2. Replace placeholder URLs and credentials:
   - `private-pypi.example.com` → Your private PyPI server
   - `your-username` → Your username
   - `your-password` → Your password or token

---

## JavaScript (npm)

### Files Created
- `javascript/.npmrc.example` - npm registry configuration

### Setup Instructions

#### Step 1: Create .npmrc from example
```bash
cd javascript
cp .npmrc.example .npmrc
```

#### Step 2: Configure authentication
Edit `.npmrc` and replace placeholders:
```ini
# Replace with your registry URL
registry=https://npm.example.com/

# Add your auth token
//npm.example.com/:_authToken=${NPM_TOKEN}
```

#### Step 3: Set environment variables
```bash
export NPM_TOKEN="your-npm-token"
```

#### Option: Using .npmrc in Docker
```dockerfile
# In Dockerfile
COPY .npmrc ./
RUN npm install --omit=dev
RUN rm -f .npmrc  # Remove after installation
```

### Generate Auth Token

#### For npm Enterprise/Artifactory
```bash
npm login --registry=https://npm.example.com/
# This updates .npmrc with auth token
```

#### For GitHub Packages
```bash
# Create token at: https://github.com/settings/tokens
# Token needs read:packages scope
export NPM_TOKEN="ghp_your_github_token"
```

---

## Java (Maven)

### Files Created
- `java/settings.xml` - Maven repository and authentication configuration

### Setup Instructions

#### Option 1: User-level settings (Recommended)
```bash
# Copy to Maven config directory
cp java/settings.xml ~/.m2/settings.xml
```

#### Option 2: Project-level settings
```bash
# Use with Maven commands
mvn clean install -s java/settings.xml
```

#### Option 3: Docker build with settings
```dockerfile
# In Dockerfile
COPY settings.xml /root/.m2/settings.xml
RUN mvn dependency:go-offline
```

### Configuration Steps

1. Edit `java/settings.xml`
2. Configure server credentials using environment variables:
```bash
export MAVEN_USERNAME="your-username"
export MAVEN_PASSWORD="your-password"
```

3. Update repository URLs in the `<profiles>` section:
```xml
<url>https://maven.example.com/repository/releases/</url>
```

### Password Encryption (Optional but Recommended)

```bash
# Step 1: Create master password
mvn --encrypt-master-password <your-master-password>
# Copy output to ~/.m2/settings-security.xml

# Step 2: Encrypt server password
mvn --encrypt-password <your-server-password>
# Use output in settings.xml <password> tag
```

---

## Docker Integration

### Python Dockerfile with Authentication
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy auth config
COPY pip.conf /etc/pip.conf

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remove auth config for security
RUN rm -f /etc/pip.conf

COPY . .
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

### JavaScript Dockerfile with Authentication
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files and auth config
COPY package*.json ./
COPY .npmrc ./

# Install dependencies
RUN npm install --omit=dev

# Remove auth config for security
RUN rm -f .npmrc

COPY . .
CMD ["node", "app.js"]
```

### Java Dockerfile with Authentication
```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copy settings and pom
COPY settings.xml /root/.m2/settings.xml
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline

# Build application
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage (no auth files)
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## Environment Variables

### Create .env files for each application

#### Python (.env)
```bash
# python/.env
PIP_INDEX_URL=https://username:password@private-pypi.example.com/simple/
PIP_EXTRA_INDEX_URL=https://pypi.org/simple/
PYPI_USERNAME=your-username
PYPI_PASSWORD=your-password
```

#### JavaScript (.env)
```bash
# javascript/.env
NPM_TOKEN=your-npm-token
NPM_REGISTRY=https://npm.example.com/
```

#### Java (.env)
```bash
# java/.env
MAVEN_USERNAME=your-username
MAVEN_PASSWORD=your-password
ARTIFACTORY_USERNAME=your-username
ARTIFACTORY_PASSWORD=your-password
GITHUB_TOKEN=ghp_your_token
```

### Using Docker Compose with Environment Variables
```yaml
version: '3.8'

services:
  python-app:
    build:
      context: ./python
      args:
        - PIP_INDEX_URL=${PIP_INDEX_URL}
    environment:
      - PIP_INDEX_URL=${PIP_INDEX_URL}
    ports:
      - "5000:5000"

  javascript-app:
    build:
      context: ./javascript
      args:
        - NPM_TOKEN=${NPM_TOKEN}
    ports:
      - "3000:3000"

  java-app:
    build:
      context: ./java
      args:
        - MAVEN_USERNAME=${MAVEN_USERNAME}
        - MAVEN_PASSWORD=${MAVEN_PASSWORD}
    ports:
      - "8080:8080"
```

---

## Security Best Practices

### 1. Never Commit Credentials
Add to `.gitignore`:
```
.npmrc
pip.conf
.pypirc
settings.xml
.env
*.credentials
```

### 2. Use Environment Variables
Always prefer environment variables over hardcoded credentials in config files.

### 3. Use Tokens Instead of Passwords
Generate and use authentication tokens with limited scope and expiration.

### 4. Remove Auth Files After Build
In Docker builds, always remove authentication files in the same layer or use multi-stage builds.

### 5. Rotate Credentials Regularly
Change tokens and passwords periodically and when team members leave.

### 6. Use Secrets Management
For production, use proper secrets management:
- Kubernetes Secrets
- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault
- Docker Secrets

---

## Troubleshooting

### Python
```bash
# Test authentication
pip install --index-url https://username:password@private-pypi.example.com/simple/ requests

# Verbose output
pip install -v package-name

# Check config
pip config list
```

### JavaScript
```bash
# Test authentication
npm whoami --registry https://npm.example.com/

# Verify config
npm config list

# Test package access
npm view @myorg/package-name
```

### Java
```bash
# Test authentication
mvn dependency:get -Dartifact=com.example:artifact:1.0.0

# Verbose output
mvn -X clean install

# Verify settings
mvn help:effective-settings
```

---

## Additional Resources

- [Python pip documentation](https://pip.pypa.io/en/stable/topics/authentication/)
- [npm configuration documentation](https://docs.npmjs.com/cli/v9/configuring-npm/npmrc)
- [Maven settings reference](https://maven.apache.org/settings.html)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
