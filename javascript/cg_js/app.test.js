const request = require('supertest');
const app = require('./app');

describe('FinView App', () => {
  test('GET / should return financial dashboard', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('FinView');
    expect(response.text).toContain('Dashboard');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe('finview-app');
  });

  test('GET /api/accounts should return accounts array', async () => {
    const response = await request(app).get('/api/accounts');
    expect(response.status).toBe(200);
    expect(response.body.accounts).toBeDefined();
    expect(Array.isArray(response.body.accounts)).toBe(true);
    expect(response.body.accounts.length).toBeGreaterThan(0);
    expect(response.body.totalBalance).toBeDefined();
  });

  test('GET /api/transactions should return transactions', async () => {
    const response = await request(app).get('/api/transactions');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.transactions)).toBe(true);
    expect(response.body.total).toBeGreaterThan(0);
  });

  test('GET /api/transactions supports category filter', async () => {
    const response = await request(app).get('/api/transactions?category=Income');
    expect(response.status).toBe(200);
    response.body.transactions.forEach(t => {
      expect(t.category.toLowerCase()).toBe('income');
    });
  });

  test('GET /api/portfolio should return holdings', async () => {
    const response = await request(app).get('/api/portfolio');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.holdings)).toBe(true);
    expect(response.body.totalValue).toBeGreaterThan(0);
  });

  test('GET /api/spending should return spending data', async () => {
    const response = await request(app).get('/api/spending');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.monthly)).toBe(true);
    expect(Array.isArray(response.body.byCategory)).toBe(true);
  });

  test('GET /api/settings should return settings object', async () => {
    const response = await request(app).get('/api/settings');
    expect(response.status).toBe(200);
    expect(response.body.display_name).toBeDefined();
    expect(response.body.currency).toBeDefined();
  });

  test('GET /transactions should return transactions page', async () => {
    const response = await request(app).get('/transactions');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Transactions');
    expect(response.text).toContain('txn-item');
  });

  test('GET /transactions supports category filter', async () => {
    const response = await request(app).get('/transactions?category=Food%20%26%20Dining');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Transactions');
  });

  test('GET /accounts should return accounts page', async () => {
    const response = await request(app).get('/accounts');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Accounts');
    expect(response.text).toContain('Net Worth');
  });

  test('GET /portfolio should return portfolio page', async () => {
    const response = await request(app).get('/portfolio');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Portfolio');
    expect(response.text).toContain('Total Value');
    expect(response.text).toContain('holdings-table');
  });

  test('GET /analytics should return analytics page', async () => {
    const response = await request(app).get('/analytics');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Analytics');
    expect(response.text).toContain('Savings Rate');
    expect(response.text).toContain('Top Merchants');
  });

  test('GET /settings should return settings page', async () => {
    const response = await request(app).get('/settings');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Settings');
    expect(response.text).toContain('Display Name');
    expect(response.text).toContain('form');
  });

  test('POST /settings should save and redirect', async () => {
    const response = await request(app)
      .post('/settings')
      .type('form')
      .send({ display_name: 'Test User', currency: 'EUR' });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/settings?saved=1');
  });

  test('GET /api/trades should return trades array', async () => {
    const response = await request(app).get('/api/trades');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.trades)).toBe(true);
  });

  test('POST /api/trade should buy stock', async () => {
    const response = await request(app)
      .post('/api/trade')
      .send({ action: 'buy', symbol: 'TSLA', name: 'Tesla Inc.', shares: 10, price: 250.00 });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.trade.symbol).toBe('TSLA');
    expect(response.body.trade.action).toBe('buy');
    expect(response.body.trade.total).toBe(2500);
  });

  test('POST /api/trade should sell stock', async () => {
    // First buy some shares
    await request(app)
      .post('/api/trade')
      .send({ action: 'buy', symbol: 'SELL_TEST', name: 'Sell Test', shares: 20, price: 100 });
    // Then sell some
    const response = await request(app)
      .post('/api/trade')
      .send({ action: 'sell', symbol: 'SELL_TEST', name: 'Sell Test', shares: 5, price: 105 });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.trade.action).toBe('sell');
    expect(response.body.trade.shares).toBe(5);
  });

  test('POST /api/trade should reject selling more shares than owned', async () => {
    const response = await request(app)
      .post('/api/trade')
      .send({ action: 'sell', symbol: 'AAPL', shares: 99999, price: 200 });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Insufficient shares');
  });

  test('POST /api/trade should reject missing fields', async () => {
    const response = await request(app)
      .post('/api/trade')
      .send({ action: 'buy' });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Missing required fields');
  });

  test('POST /api/trade should reject invalid action', async () => {
    const response = await request(app)
      .post('/api/trade')
      .send({ action: 'hold', symbol: 'AAPL', shares: 1, price: 200 });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('buy');
  });

  test('GET /trade should return trade page', async () => {
    const response = await request(app).get('/trade');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Trade');
    expect(response.text).toContain('Place Order');
    expect(response.text).toContain('Buy');
    expect(response.text).toContain('Sell');
  });

  test('POST /trade should execute trade and redirect', async () => {
    const response = await request(app)
      .post('/trade')
      .type('form')
      .send({ action: 'buy', symbol: 'NVDA', name: 'NVIDIA Corp.', shares: 5, price: 800 });
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/trade?success=');
  });
});
