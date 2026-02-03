FROM cgr.dev/chainguard-private/python:3.11-dev

# Accept build arguments for registry credentials
ARG PIP_INDEX_URL
ARG PIP_EXTRA_INDEX_URL

# Set as environment variables for pip to use
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_EXTRA_INDEX_URL=${PIP_EXTRA_INDEX_URL}

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Run the application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
