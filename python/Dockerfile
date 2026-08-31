FROM cgr.dev/mikeco.com/python:3.11-dev

# Accept build arguments for registry credentials and variant selection
ARG PIP_INDEX_URL
ARG PIP_EXTRA_INDEX_URL=
ARG REQUIREMENTS=requirements.txt

# Set as environment variables for pip to use
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
ENV PIP_EXTRA_INDEX_URL=${PIP_EXTRA_INDEX_URL}

# Prefer wheels over newer sdist-only releases (Chainguard rebuilds wheels;
# without this pip may pick a newer sdist and try to compile from source)
ENV PIP_PREFER_BINARY=1

WORKDIR /app

# Install dependencies
COPY ${REQUIREMENTS} requirements.txt
RUN pip install -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Run the application (clear the base image's `python` entrypoint and run
# gunicorn as a module — its console script is not on the image's PATH)
ENTRYPOINT []
CMD ["python", "-m", "gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
