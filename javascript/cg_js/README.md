# JavaScript/Node.js Express Application

An Express-based REST API with Redis caching, security middleware, and HTTP proxy capabilities.

## Libraries Used
- express 4.18.2 - Web framework
- axios 1.6.5 - HTTP client
- dotenv 16.3.1 - Environment variable management
- pg 8.11.3 - PostgreSQL client
- redis 4.6.12 - Redis client
- mongoose 8.1.0 - MongoDB ODM
- cors 2.8.5 - CORS middleware
- morgan 1.10.0 - HTTP request logger
- helmet 7.1.0 - Security middleware
- joi 17.11.0 - Data validation
- jsonwebtoken 9.0.2 - JWT authentication
- bcryptjs 2.4.3 - Password hashing

## Build and Run

### Using Docker
```bash
docker build -t javascript-app .
docker run -p 3000:3000 javascript-app
```

### Local Development
```bash
npm install
npm start
```

### Development with Hot Reload
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

## Endpoints
- `GET /` - Application info
- `GET /health` - Health check
- `GET /api/users` - Get users
- `POST /api/users` - Create user
- `GET /api/proxy?url=<url>` - Proxy HTTP requests
- `GET /api/cache/:key` - Get cached value
- `POST /api/cache/:key` - Set cached value
