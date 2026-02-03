FROM cgr.dev/chainguard-private/node:18-dev

# Accept build arguments
ARG NPM_USERNAME
ARG NPM_PASSWORD
ARG NPM_EMAIL

# Set as environment variables for npm to use
ENV NPM_USERNAME=${NPM_USERNAME}
ENV NPM_PASSWORD=${NPM_PASSWORD}
ENV NPM_EMAIL=${NPM_EMAIL}

WORKDIR /app

# Copy npm configuration to use private registry
COPY .npmrc /home/nonroot/.npmrc

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "app.js"]
