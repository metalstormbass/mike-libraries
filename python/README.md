# Python Flask Application

A Flask-based web application with Redis caching, SQLAlchemy ORM, and async HTTP support.

## Libraries Used
- Flask 3.1.2 - Web framework
- aiohttp 3.9.1 - Async HTTP client
- gunicorn 23.0.0 - WSGI HTTP server
- requests 2.32.4 - HTTP library
- SQLAlchemy 2.0.25 - SQL ORM
- psycopg2-binary 2.9.9 - PostgreSQL adapter
- redis 5.0.1 - Redis client
- celery 5.3.6 - Distributed task queue
- python-dotenv 1.0.0 - Environment variable management
- pytest 7.4.3 - Testing framework

## Build and Run

### Using Docker
```bash
docker build -t python-app .
docker run -p 5000:5000 python-app
```

### Local Development
```bash
pip install -r requirements.txt
python app.py
```

### Run Tests
```bash
pytest test_app.py
```

## Endpoints
- `GET /` - Application info
- `GET /health` - Health check
- `GET /items` - Get items
- `POST /items` - Create item
- `GET /cache/<key>` - Get cached value
- `POST /cache/<key>` - Set cached value
