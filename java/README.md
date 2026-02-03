# Java Spring Boot Application

A Spring Boot REST API with JPA/Hibernate, Redis caching, and comprehensive utility libraries.

## Libraries Used
- Spring Boot 3.2.1 - Application framework
  - spring-boot-starter-web - REST API support
  - spring-boot-starter-data-jpa - JPA/Hibernate ORM
  - spring-boot-starter-data-redis - Redis support
  - spring-boot-starter-validation - Bean validation
- PostgreSQL - Database driver
- H2 Database - In-memory database for testing
- Lombok - Boilerplate code reduction
- Jackson - JSON processing
- Apache Commons Lang3 - Utility functions
- Google Guava - Core libraries
- JUnit 5 - Testing framework

## Build and Run

### Using Docker
```bash
docker build -t java-app .
docker run -p 8080:8080 java-app
```

### Local Development with Maven
```bash
mvn spring-boot:run
```

### Build JAR
```bash
mvn clean package
java -jar target/java-app-1.0.0.jar
```

### Run Tests
```bash
mvn test
```

## Endpoints
- `GET /api/` - Application info
- `GET /api/health` - Health check
- `GET /api/items` - Get items
- `POST /api/items` - Create item
- `GET /api/cache/{key}` - Get cached value
- `POST /api/cache/{key}` - Set cached value

## Configuration
Edit [application.properties](src/main/resources/application.properties) to configure:
- Server port
- Database connection
- Redis connection
- Logging levels
