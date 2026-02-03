const request = require('supertest');
const app = require('./app');

describe('Express App', () => {
  test('GET / should return app info', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('JavaScript/Node.js Express Application');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('javascript-app');
  });

  test('GET /api/users should return users array', async () => {
    const response = await request(app).get('/api/users');
    expect(response.status).toBe(200);
    expect(response.body.users).toBeDefined();
    expect(Array.isArray(response.body.users)).toBe(true);
  });

  test('POST /api/users should create a user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'Test User', email: 'test@example.com' });
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User created');
  });
});
