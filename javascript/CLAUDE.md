# JavaScript Libraries Project

## Structure

This project contains two copies of the same Express.js application:

- **`js/`** — Pulls libraries from **public npm** (`registry.npmjs.org`). Uses a standard `node:22-slim` Docker image.
- **`cg_js/`** — Pulls libraries from **Chainguard Libraries** (`libraries.cgr.dev/javascript`). Uses the Chainguard `cgr.dev/chainguard-private/node:24-dev` Docker image.

## Keeping Folders in Sync

The application code (`app.js`, `app.test.js`, `README.md`, `package.json`) must be identical between `js/` and `cg_js/`. The only files that should differ are:

- **`Dockerfile`** — Different base image and registry setup
- **`.npmrc`** — Different registry configuration and auth

When making changes to application logic, apply the same change to both folders.

## Running

```bash
# Install & test (from either folder)
npm install
npm test

# Run locally
npm start        # http://localhost:3000

# Docker
docker build -t javascript-app .
docker run -p 3000:3000 javascript-app
```
