# mike-libraries

A collection of sample applications demonstrating best practices across different programming languages.

## Project Structure

This repository contains three fully-featured REST API applications, each built with popular frameworks and libraries in their respective languages:

### [Python Application](python/)
- **Framework**: Flask 3.1.2
- **Port**: 5000
- **Key Libraries**: SQLAlchemy, Redis, Celery, Gunicorn
- **Features**: REST API with ORM, caching, async HTTP, and task queue support

### [JavaScript Application](javascript/)
- **Framework**: Express 4.18.2
- **Port**: 3000
- **Key Libraries**: Axios, Redis, Mongoose, Helmet, JWT
- **Features**: REST API with security middleware, MongoDB support, and HTTP proxy

### [Java Application](java/)
- **Framework**: Spring Boot 3.2.1
- **Port**: 8080
- **Key Libraries**: Spring Data JPA, Redis, PostgreSQL, Lombok, Guava
- **Features**: REST API with JPA/Hibernate, Redis caching, and validation

## Quick Start

Each application can be run independently using Docker:

```bash
# Python
cd python && docker build -t python-app . && docker run -p 5000:5000 python-app

# JavaScript
cd javascript && docker build -t javascript-app . && docker run -p 3000:3000 javascript-app

# Java
cd java && docker build -t java-app . && docker run -p 8080:8080 java-app
```

See individual README files in each directory for detailed documentation and local development setup.