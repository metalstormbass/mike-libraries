FROM cgr.dev/chainguard-private/node:22-dev

USER node
WORKDIR /app

# Copy registry config and package manifest
COPY --chown=node:node .npmrc .npmrc
COPY --chown=node:node package.json ./

# Create npm cache directory and install dependencies
RUN mkdir -p /home/node/.npm && npm install --omit=dev

# Copy application code
COPY --chown=node:node . .

# Expose port
EXPOSE 3000

# Run the application
ENTRYPOINT []
CMD ["node", "app.js"]
