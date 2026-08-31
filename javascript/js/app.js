const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const { format, subDays, subMonths, startOfMonth, endOfMonth } = require('date-fns');
const _ = require('lodash');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    }
  }
}));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis client setup
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));

// --- Database Setup ---

let pool;
let dbAvailable = false;

function createPool() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://finview:finview@localhost:5432/finview',
    max: 10,
    connectionTimeoutMillis: 3000,
  });
  pool.on('error', (err) => {
    console.error('Unexpected pool error', err);
  });
}

// --- Mock / Seed Data ---

const seedAccounts = [
  { id: 'acc_1', name: 'Primary Checking', type: 'checking', balance: 12847.53, currency: 'USD', institution: 'Chase', last_four: '4821' },
  { id: 'acc_2', name: 'High-Yield Savings', type: 'savings', balance: 45230.00, currency: 'USD', institution: 'Marcus', last_four: '7734' },
  { id: 'acc_3', name: 'Investment Portfolio', type: 'investment', balance: 128450.67, currency: 'USD', institution: 'Fidelity', last_four: '9012' },
  { id: 'acc_4', name: 'Credit Card', type: 'credit', balance: -2341.18, currency: 'USD', institution: 'Amex', last_four: '3045' },
];

const categories = ['Housing', 'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Utilities', 'Healthcare', 'Income', 'Transfer', 'Investment'];

const merchants = [
  { name: 'Whole Foods Market', category: 'Food & Dining', icon: 'cart' },
  { name: 'Netflix', category: 'Entertainment', icon: 'play' },
  { name: 'Uber', category: 'Transportation', icon: 'car' },
  { name: 'Amazon', category: 'Shopping', icon: 'package' },
  { name: 'Con Edison', category: 'Utilities', icon: 'zap' },
  { name: 'CVS Pharmacy', category: 'Healthcare', icon: 'heart' },
  { name: 'Spotify', category: 'Entertainment', icon: 'play' },
  { name: 'Shell Gas', category: 'Transportation', icon: 'car' },
  { name: 'Target', category: 'Shopping', icon: 'package' },
  { name: 'Starbucks', category: 'Food & Dining', icon: 'cart' },
  { name: 'Rent Payment', category: 'Housing', icon: 'home' },
  { name: 'Employer Direct Deposit', category: 'Income', icon: 'dollar' },
  { name: 'Transfer to Savings', category: 'Transfer', icon: 'arrow' },
  { name: 'Vanguard Buy', category: 'Investment', icon: 'trending' },
  { name: 'Chipotle', category: 'Food & Dining', icon: 'cart' },
  { name: 'Delta Airlines', category: 'Transportation', icon: 'car' },
  { name: 'Apple Store', category: 'Shopping', icon: 'package' },
  { name: 'Planet Fitness', category: 'Healthcare', icon: 'heart' },
];

function generateTransactions(count) {
  const txns = [];
  for (let i = 0; i < count; i++) {
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    const isIncome = merchant.category === 'Income';
    const isTransfer = merchant.category === 'Transfer';
    const isInvestment = merchant.category === 'Investment';
    let amount;
    if (isIncome) amount = _.random(3200, 5500, true);
    else if (isTransfer) amount = -_.random(500, 2000, true);
    else if (isInvestment) amount = -_.random(200, 1500, true);
    else amount = -_.random(4.5, 350, true);

    txns.push({
      id: uuidv4(),
      date: format(subDays(new Date(), Math.floor(Math.random() * 90)), 'yyyy-MM-dd'),
      merchant: merchant.name,
      category: merchant.category,
      amount: Math.round(amount * 100) / 100,
      account: seedAccounts[Math.floor(Math.random() * 2)].name,
      status: Math.random() > 0.05 ? 'completed' : 'pending',
      icon: merchant.icon,
    });
  }
  return _.orderBy(txns, ['date'], ['desc']);
}

const seedTransactions = generateTransactions(50);

const seedPortfolio = [
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', shares: 142, price: 268.45, change: 1.23, allocation: 29.7 },
  { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', shares: 210, price: 62.18, change: -0.45, allocation: 10.2 },
  { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', shares: 185, price: 71.30, change: 0.12, allocation: 10.3 },
  { symbol: 'VGT', name: 'Vanguard Information Technology ETF', shares: 38, price: 582.90, change: 2.87, allocation: 17.2 },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', shares: 95, price: 84.55, change: -0.68, allocation: 6.3 },
  { symbol: 'AAPL', name: 'Apple Inc.', shares: 50, price: 213.25, change: 3.12, allocation: 8.3 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', shares: 30, price: 448.60, change: 1.95, allocation: 10.5 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 45, price: 178.90, change: -1.34, allocation: 6.3 },
  { symbol: 'Cash', name: 'Money Market', shares: 1, price: 1682.42, change: 0, allocation: 1.3 },
];

const tradeHistory = [];

const monthlySpending = [
  { month: 'Nov', amount: 4820 },
  { month: 'Dec', amount: 6210 },
  { month: 'Jan', amount: 4150 },
  { month: 'Feb', amount: 3890 },
  { month: 'Mar', amount: 4560 },
  { month: 'Apr', amount: 3240 },
];

const spendingByCategory = [
  { category: 'Housing', amount: 2100, color: '#6366f1' },
  { category: 'Food & Dining', amount: 680, color: '#f59e0b' },
  { category: 'Transportation', amount: 420, color: '#10b981' },
  { category: 'Shopping', amount: 530, color: '#ec4899' },
  { category: 'Entertainment', amount: 180, color: '#8b5cf6' },
  { category: 'Utilities', amount: 290, color: '#06b6d4' },
  { category: 'Healthcare', amount: 150, color: '#ef4444' },
];

// --- Database Initialization ---

async function initDB() {
  try {
    createPool();
    await pool.query('SELECT 1');
    dbAvailable = true;
    console.log('Connected to PostgreSQL');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        balance NUMERIC(12,2) NOT NULL,
        currency TEXT DEFAULT 'USD',
        institution TEXT,
        last_four TEXT
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        merchant TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        account TEXT,
        status TEXT DEFAULT 'completed',
        icon TEXT
      );
      CREATE TABLE IF NOT EXISTS portfolio (
        symbol TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        shares NUMERIC(12,4) NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        change NUMERIC(8,2) DEFAULT 0,
        allocation NUMERIC(5,1) DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trade_history (
        id TEXT PRIMARY KEY,
        date TIMESTAMP NOT NULL DEFAULT NOW(),
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        action TEXT NOT NULL,
        shares NUMERIC(12,4) NOT NULL,
        price NUMERIC(12,2) NOT NULL,
        total NUMERIC(14,2) NOT NULL
      );
    `);

    // Seed if tables are empty
    const { rows: accCount } = await pool.query('SELECT COUNT(*) FROM accounts');
    if (parseInt(accCount[0].count) === 0) {
      for (const a of seedAccounts) {
        await pool.query(
          'INSERT INTO accounts (id, name, type, balance, currency, institution, last_four) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [a.id, a.name, a.type, a.balance, a.currency, a.institution, a.last_four]
        );
      }
      for (const t of seedTransactions) {
        await pool.query(
          'INSERT INTO transactions (id, date, merchant, category, amount, account, status, icon) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [t.id, t.date, t.merchant, t.category, t.amount, t.account, t.status, t.icon]
        );
      }
      for (const h of seedPortfolio) {
        await pool.query(
          'INSERT INTO portfolio (symbol, name, shares, price, change, allocation) VALUES ($1,$2,$3,$4,$5,$6)',
          [h.symbol, h.name, h.shares, h.price, h.change, h.allocation]
        );
      }
      // Default settings
      const defaults = { display_name: 'Alex Morgan', currency: 'USD', notifications: 'true', email_reports: 'weekly' };
      for (const [k, v] of Object.entries(defaults)) {
        await pool.query('INSERT INTO user_settings (key, value) VALUES ($1, $2)', [k, v]);
      }
      console.log('Database seeded');
    }
  } catch (err) {
    console.log('Database not available, using in-memory data:', err.message);
    dbAvailable = false;
  }
}

// --- Data Access Helpers ---

async function getAccounts() {
  if (dbAvailable) {
    const { rows } = await pool.query('SELECT * FROM accounts ORDER BY type');
    return rows.map(r => ({ ...r, balance: parseFloat(r.balance), lastFour: r.last_four }));
  }
  return seedAccounts.map(a => ({ ...a, lastFour: a.last_four }));
}

async function getTransactions({ category, limit = 50, offset = 0 } = {}) {
  if (dbAvailable) {
    let query = 'SELECT * FROM transactions';
    const params = [];
    if (category) {
      query += ' WHERE LOWER(category) = LOWER($1)';
      params.push(category);
    }
    query += ' ORDER BY date DESC';
    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }
    const { rows } = await pool.query(query, params);
    const countQuery = category
      ? { text: 'SELECT COUNT(*) FROM transactions WHERE LOWER(category) = LOWER($1)', values: [category] }
      : { text: 'SELECT COUNT(*) FROM transactions' };
    const { rows: countRows } = await pool.query(countQuery);
    return {
      transactions: rows.map(r => ({ ...r, amount: parseFloat(r.amount) })),
      total: parseInt(countRows[0].count),
    };
  }
  let filtered = seedTransactions;
  if (category) filtered = filtered.filter(t => t.category.toLowerCase() === category.toLowerCase());
  return { transactions: filtered.slice(offset, offset + Number(limit)), total: filtered.length };
}

async function getPortfolio() {
  if (dbAvailable) {
    const { rows } = await pool.query('SELECT * FROM portfolio ORDER BY allocation DESC');
    return rows.map(r => ({
      ...r,
      shares: parseFloat(r.shares),
      price: parseFloat(r.price),
      change: parseFloat(r.change),
      allocation: parseFloat(r.allocation),
    }));
  }
  return seedPortfolio;
}

async function getSettings() {
  if (dbAvailable) {
    const { rows } = await pool.query('SELECT * FROM user_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return settings;
  }
  return { display_name: 'Alex Morgan', currency: 'USD', notifications: 'true', email_reports: 'weekly' };
}

async function saveSetting(key, value) {
  if (dbAvailable) {
    await pool.query(
      'INSERT INTO user_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
  }
}

async function executeTrade({ action, symbol, name, shares, price }) {
  const total = Math.round(shares * price * 100) / 100;
  const trade = { id: uuidv4(), date: new Date().toISOString(), symbol, name, action, shares, price, total };

  if (dbAvailable) {
    // Update portfolio
    const { rows } = await pool.query('SELECT * FROM portfolio WHERE symbol = $1', [symbol]);
    if (action === 'buy') {
      if (rows.length > 0) {
        const existing = rows[0];
        const newShares = parseFloat(existing.shares) + shares;
        await pool.query('UPDATE portfolio SET shares = $1 WHERE symbol = $2', [newShares, symbol]);
      } else {
        await pool.query(
          'INSERT INTO portfolio (symbol, name, shares, price, change, allocation) VALUES ($1,$2,$3,$4,0,0)',
          [symbol, name, shares, price]
        );
      }
    } else {
      if (rows.length === 0) throw new Error(`No holding found for ${symbol}`);
      const existing = rows[0];
      const currentShares = parseFloat(existing.shares);
      if (shares > currentShares) throw new Error(`Insufficient shares: have ${currentShares}, trying to sell ${shares}`);
      const newShares = currentShares - shares;
      if (newShares === 0) {
        await pool.query('DELETE FROM portfolio WHERE symbol = $1', [symbol]);
      } else {
        await pool.query('UPDATE portfolio SET shares = $1 WHERE symbol = $2', [newShares, symbol]);
      }
    }
    // Record trade
    await pool.query(
      'INSERT INTO trade_history (id, date, symbol, name, action, shares, price, total) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [trade.id, trade.date, symbol, name, action, shares, price, total]
    );
  } else {
    // In-memory
    if (action === 'buy') {
      const existing = seedPortfolio.find(h => h.symbol === symbol);
      if (existing) {
        existing.shares += shares;
      } else {
        seedPortfolio.push({ symbol, name, shares, price, change: 0, allocation: 0 });
      }
    } else {
      const existing = seedPortfolio.find(h => h.symbol === symbol);
      if (!existing) throw new Error(`No holding found for ${symbol}`);
      if (shares > existing.shares) throw new Error(`Insufficient shares: have ${existing.shares}, trying to sell ${shares}`);
      existing.shares -= shares;
      if (existing.shares === 0) {
        seedPortfolio.splice(seedPortfolio.indexOf(existing), 1);
      }
    }
    tradeHistory.unshift(trade);
  }

  return trade;
}

async function getTradeHistory(limit = 20) {
  if (dbAvailable) {
    const { rows } = await pool.query('SELECT * FROM trade_history ORDER BY date DESC LIMIT $1', [limit]);
    return rows.map(r => ({
      ...r,
      shares: parseFloat(r.shares),
      price: parseFloat(r.price),
      total: parseFloat(r.total),
    }));
  }
  return tradeHistory.slice(0, limit);
}

// --- Shared HTML Helpers ---

const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtSign = (n) => (n >= 0 ? '+' : '') + fmt(n);

const iconSVGs = {
  cart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
  play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  car: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
  'package': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  dollar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  trending: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
};

function getCSS() {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-primary: #0a0e1a;
      --bg-secondary: #111827;
      --bg-card: #1a2035;
      --bg-hover: #1f2847;
      --border: #2a3352;
      --border-light: #374063;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-indigo: #6366f1;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --accent-amber: #f59e0b;
      --accent-cyan: #06b6d4;
      --accent-purple: #8b5cf6;
      --accent-pink: #ec4899;
      --radius: 12px;
      --radius-sm: 8px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    .app-container { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar {
      width: 260px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 10;
    }
    .logo {
      display: flex; align-items: center; gap: 10px;
      padding: 0 8px 24px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
      text-decoration: none;
    }
    .logo-icon {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-indigo));
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px; color: #fff;
    }
    .logo-text { font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px; }
    .nav-section { margin-bottom: 24px; }
    .nav-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.8px; color: var(--text-muted); padding: 0 12px; margin-bottom: 8px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: var(--radius-sm);
      color: var(--text-secondary); font-size: 14px; font-weight: 500;
      cursor: pointer; transition: all 0.15s; text-decoration: none;
    }
    .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
    .nav-item.active { background: rgba(99, 102, 241, 0.12); color: var(--accent-indigo); }
    .nav-icon { width: 20px; height: 20px; opacity: 0.7; }
    .nav-item.active .nav-icon { opacity: 1; }
    .db-badge {
      margin-top: auto; padding: 10px 12px; border-radius: var(--radius-sm);
      background: var(--bg-card); border: 1px solid var(--border);
      font-size: 11px; color: var(--text-muted);
      display: flex; align-items: center; gap: 8px;
    }
    .db-dot { width: 8px; height: 8px; border-radius: 50%; }
    .db-dot.up { background: var(--accent-green); }
    .db-dot.down { background: var(--accent-red); }

    /* Main content */
    .main { flex: 1; margin-left: 260px; padding: 32px; max-width: 1200px; }
    .page-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px;
    }
    .page-title { font-size: 24px; font-weight: 700; color: var(--text-primary); }
    .page-subtitle { font-size: 14px; color: var(--text-muted); margin-top: 2px; }
    .header-actions { display: flex; gap: 10px; }
    .btn-primary {
      padding: 9px 18px; background: var(--accent-indigo); border: none;
      border-radius: var(--radius-sm); color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: background 0.15s; text-decoration: none;
    }
    .btn-primary:hover { background: #5558e6; }
    .btn-outline {
      padding: 9px 18px; background: transparent; border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 13px; font-weight: 500;
      cursor: pointer; font-family: inherit; transition: all 0.15s; text-decoration: none;
    }
    .btn-outline:hover { border-color: var(--border-light); color: var(--text-primary); }

    /* Summary Cards */
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .summary-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px; transition: border-color 0.15s;
    }
    .summary-card:hover { border-color: var(--border-light); }
    .card-label { font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .card-value { font-size: 28px; font-weight: 700; letter-spacing: -1px; margin-bottom: 6px; }
    .card-change { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 4px; }
    .change-up { color: var(--accent-green); }
    .change-down { color: var(--accent-red); }
    .card-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
    .card-icon.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    .card-icon.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    .card-icon.red { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    .card-icon.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }

    /* Content Grid */
    .content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }
    .content-grid.wide { grid-template-columns: 1.4fr 1fr; }
    .content-grid.full { grid-template-columns: 1fr; }

    .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 20px; border-bottom: 1px solid var(--border);
    }
    .card-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
    .card-action { font-size: 13px; color: var(--accent-indigo); cursor: pointer; font-weight: 500; text-decoration: none; }
    .card-action:hover { color: #818cf8; }
    .card-body { padding: 20px; }

    /* Transactions */
    .txn-list { display: flex; flex-direction: column; }
    .txn-item {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 20px; border-bottom: 1px solid rgba(42, 51, 82, 0.5); transition: background 0.1s;
    }
    .txn-item:last-child { border-bottom: none; }
    .txn-item:hover { background: var(--bg-hover); }
    .txn-icon {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
    }
    .txn-icon.cart { background: rgba(245, 158, 11, 0.12); color: var(--accent-amber); }
    .txn-icon.play { background: rgba(139, 92, 246, 0.12); color: var(--accent-purple); }
    .txn-icon.car { background: rgba(16, 185, 129, 0.12); color: var(--accent-green); }
    .txn-icon.package { background: rgba(236, 72, 153, 0.12); color: var(--accent-pink); }
    .txn-icon.zap { background: rgba(6, 182, 212, 0.12); color: var(--accent-cyan); }
    .txn-icon.heart { background: rgba(239, 68, 68, 0.12); color: var(--accent-red); }
    .txn-icon.home { background: rgba(99, 102, 241, 0.12); color: var(--accent-indigo); }
    .txn-icon.dollar { background: rgba(16, 185, 129, 0.12); color: var(--accent-green); }
    .txn-icon.arrow { background: rgba(59, 130, 246, 0.12); color: var(--accent-blue); }
    .txn-icon.trending { background: rgba(139, 92, 246, 0.12); color: var(--accent-purple); }
    .txn-info { flex: 1; min-width: 0; }
    .txn-merchant { font-size: 14px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .txn-category { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
    .txn-right { text-align: right; flex-shrink: 0; }
    .txn-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .txn-amount.positive { color: var(--accent-green); }
    .txn-amount.negative { color: var(--text-primary); }
    .txn-date { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
    .txn-status { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px; }
    .txn-status.pending { background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); }
    .txn-status.completed { background: rgba(16, 185, 129, 0.1); color: var(--accent-green); }

    /* Accounts */
    .account-list { display: flex; flex-direction: column; gap: 10px; }
    .account-item {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px; background: var(--bg-primary);
      border-radius: var(--radius-sm); border: 1px solid rgba(42, 51, 82, 0.5); transition: border-color 0.15s;
    }
    .account-item:hover { border-color: var(--border-light); }
    .account-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .account-icon.checking { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    .account-icon.savings { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    .account-icon.investment { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
    .account-icon.credit { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    .account-info { flex: 1; }
    .account-name { font-size: 14px; font-weight: 500; color: var(--text-primary); }
    .account-detail { font-size: 12px; color: var(--text-muted); }
    .account-balance { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }

    /* Bar Chart */
    .bar-chart { display: flex; align-items: flex-end; gap: 12px; height: 160px; padding-top: 10px; }
    .bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; }
    .bar { width: 100%; max-width: 48px; border-radius: 6px 6px 3px 3px; background: linear-gradient(180deg, var(--accent-indigo), rgba(99, 102, 241, 0.4)); transition: opacity 0.15s; }
    .bar:hover { opacity: 0.85; }
    .bar-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }
    .bar-value { font-size: 11px; color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }

    /* Category Spending */
    .category-list { display: flex; flex-direction: column; gap: 14px; }
    .category-item { display: flex; align-items: center; gap: 12px; }
    .category-color { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
    .category-name { font-size: 13px; color: var(--text-secondary); flex: 1; }
    .category-bar-wrap { flex: 2; height: 6px; background: rgba(42, 51, 82, 0.5); border-radius: 3px; overflow: hidden; }
    .category-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .category-amount { font-size: 13px; font-weight: 600; color: var(--text-primary); min-width: 60px; text-align: right; font-variant-numeric: tabular-nums; }

    /* Holdings Table */
    .holdings-table { width: 100%; border-collapse: collapse; }
    .holdings-table th {
      text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px; padding: 0 16px 12px; border-bottom: 1px solid var(--border);
    }
    .holdings-table th:last-child, .holdings-table td:last-child { text-align: right; }
    .holdings-table th:nth-child(3), .holdings-table td:nth-child(3) { text-align: right; }
    .holdings-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid rgba(42, 51, 82, 0.4); }
    .holdings-table tr:last-child td { border-bottom: none; }
    .holdings-table tr:hover td { background: var(--bg-hover); }
    .holding-symbol { font-weight: 600; color: var(--text-primary); }
    .holding-name { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
    .alloc-bar-wrap { width: 60px; height: 4px; background: rgba(42, 51, 82, 0.5); border-radius: 2px; display: inline-block; vertical-align: middle; margin-right: 6px; }
    .alloc-bar { height: 100%; background: var(--accent-indigo); border-radius: 2px; }

    /* Filter bar */
    .filter-bar { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-chip {
      padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--border); background: transparent; color: var(--text-secondary);
      cursor: pointer; transition: all 0.15s; text-decoration: none;
    }
    .filter-chip:hover { border-color: var(--border-light); color: var(--text-primary); }
    .filter-chip.active { background: var(--accent-indigo); border-color: var(--accent-indigo); color: #fff; }

    /* Settings form */
    .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 6px; }
    .form-input {
      width: 100%; padding: 10px 14px; background: var(--bg-primary);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-primary); font-size: 14px; font-family: inherit; transition: border-color 0.15s;
    }
    .form-input:focus { outline: none; border-color: var(--accent-indigo); }
    .form-select {
      width: 100%; padding: 10px 14px; background: var(--bg-primary);
      border: 1px solid var(--border); border-radius: var(--radius-sm);
      color: var(--text-primary); font-size: 14px; font-family: inherit;
      appearance: none; cursor: pointer;
    }
    .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(42,51,82,0.5); }
    .toggle-label { font-size: 14px; color: var(--text-primary); }
    .toggle-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .toggle { width: 44px; height: 24px; border-radius: 12px; background: var(--border); cursor: pointer; position: relative; border: none; transition: background 0.2s; flex-shrink: 0; }
    .toggle.on { background: var(--accent-indigo); }
    .toggle::after { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: #fff; top: 3px; left: 3px; transition: transform 0.2s; }
    .toggle.on::after { transform: translateX(20px); }
    .save-banner { padding: 12px 20px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-sm); color: var(--accent-green); font-size: 14px; margin-bottom: 20px; display: none; }
    .save-banner.show { display: block; }

    /* Account detail cards */
    .account-detail-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 24px; margin-bottom: 16px; transition: border-color 0.15s;
    }
    .account-detail-card:hover { border-color: var(--border-light); }
    .account-detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .account-detail-icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center; font-size: 22px;
    }
    .account-detail-name { font-size: 18px; font-weight: 600; }
    .account-detail-sub { font-size: 13px; color: var(--text-muted); }
    .account-detail-balance { font-size: 32px; font-weight: 700; letter-spacing: -1px; margin-bottom: 4px; }
    .account-detail-meta { display: flex; gap: 24px; margin-top: 12px; }
    .meta-item { font-size: 13px; color: var(--text-muted); }
    .meta-value { color: var(--text-primary); font-weight: 500; }

    /* Trade */
    .trade-layout { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; }
    .trade-form-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
    .trade-toggle { display: flex; gap: 0; margin-bottom: 20px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }
    .trade-toggle-btn {
      flex: 1; padding: 10px; text-align: center; font-size: 14px; font-weight: 600;
      border: none; cursor: pointer; font-family: inherit; transition: all 0.15s;
      background: transparent; color: var(--text-muted);
    }
    .trade-toggle-btn.active-buy { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    .trade-toggle-btn.active-sell { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    .trade-summary {
      margin-top: 16px; padding: 14px; background: var(--bg-primary);
      border-radius: var(--radius-sm); border: 1px solid var(--border);
    }
    .trade-summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .trade-summary-row.total { font-weight: 600; font-size: 15px; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }
    .trade-history-item {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 20px; border-bottom: 1px solid rgba(42, 51, 82, 0.5);
    }
    .trade-history-item:last-child { border-bottom: none; }
    .trade-badge {
      display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px;
      border-radius: 4px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .trade-badge.buy { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    .trade-badge.sell { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    .btn-buy {
      width: 100%; padding: 12px; background: var(--accent-green); border: none;
      border-radius: var(--radius-sm); color: #fff; font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: opacity 0.15s;
    }
    .btn-buy:hover { opacity: 0.9; }
    .btn-sell {
      width: 100%; padding: 12px; background: var(--accent-red); border: none;
      border-radius: var(--radius-sm); color: #fff; font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: opacity 0.15s;
    }
    .btn-sell:hover { opacity: 0.9; }
    .trade-msg {
      padding: 12px 16px; border-radius: var(--radius-sm); font-size: 14px; margin-bottom: 16px;
    }
    .trade-msg.success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); color: var(--accent-green); }
    .trade-msg.error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: var(--accent-red); }
    @media (max-width: 1100px) {
      .trade-layout { grid-template-columns: 1fr; }
    }

    /* Responsive */
    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .content-grid, .content-grid.wide { grid-template-columns: 1fr; }
      .settings-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; padding: 20px 16px; }
      .summary-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
    }
  `;
}

function getSidebar(activePage) {
  const navItems = [
    { section: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', href: '/', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' },
      { id: 'transactions', label: 'Transactions', href: '/transactions', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
      { id: 'accounts', label: 'Accounts', href: '/accounts', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' },
    ]},
    { section: 'Invest', items: [
      { id: 'portfolio', label: 'Portfolio', href: '/portfolio', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' },
      { id: 'trade', label: 'Trade', href: '/trade', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' },
    ]},
    { section: 'Insights', items: [
      { id: 'analytics', label: 'Analytics', href: '/analytics', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
      { id: 'settings', label: 'Settings', href: '/settings', icon: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
    ]},
  ];

  let html = `
    <nav class="sidebar">
      <a class="logo" href="/">
        <div class="logo-icon">F</div>
        <span class="logo-text">FinView</span>
      </a>`;

  for (const section of navItems) {
    html += `<div class="nav-section"><div class="nav-label">${section.section}</div>`;
    for (const item of section.items) {
      const active = item.id === activePage ? ' active' : '';
      html += `<a class="nav-item${active}" href="${item.href}">${item.icon} ${item.label}</a>`;
    }
    html += '</div>';
  }

  html += `
      <div class="db-badge">
        <div class="db-dot ${dbAvailable ? 'up' : 'down'}"></div>
        PostgreSQL ${dbAvailable ? 'Connected' : 'Offline'}
      </div>
    </nav>`;

  return html;
}

function pageWrapper(title, subtitle, content, activePage, headExtra = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FinView</title>
  <style>${getCSS()}</style>
  ${headExtra}
</head>
<body>
  <div class="app-container">
    ${getSidebar(activePage)}
    <main class="main">
      <div class="page-header">
        <div>
          <h1 class="page-title">${title}</h1>
          <p class="page-subtitle">${subtitle}</p>
        </div>
      </div>
      ${content}
    </main>
  </div>
</body>
</html>`;
}

function renderTxnRow(t) {
  const statusBadge = t.status === 'pending' ? ' <span class="txn-status pending">pending</span>' : '';
  return `<div class="txn-item">
    <div class="txn-icon ${t.icon}">${iconSVGs[t.icon] || iconSVGs.dollar}</div>
    <div class="txn-info">
      <div class="txn-merchant">${t.merchant}</div>
      <div class="txn-category">${t.category}${statusBadge}</div>
    </div>
    <div class="txn-right">
      <div class="txn-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}$${fmt(Math.abs(t.amount))}</div>
      <div class="txn-date">${t.date}</div>
    </div>
  </div>`;
}

// --- Routes ---

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'finview-app', database: dbAvailable ? 'connected' : 'offline' });
});

// API routes
app.get('/api/accounts', async (req, res) => {
  const accounts = await getAccounts();
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  res.json({ accounts, totalBalance });
});

app.get('/api/transactions', async (req, res) => {
  const { category, limit = 50 } = req.query;
  const result = await getTransactions({ category, limit: Number(limit) });
  res.json(result);
});

app.get('/api/portfolio', async (req, res) => {
  const holdings = await getPortfolio();
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.price, 0);
  const mapped = holdings.map(h => ({
    ...h,
    value: Math.round(h.shares * h.price * 100) / 100,
    dayChange: Math.round(h.shares * h.change * 100) / 100,
  }));
  res.json({ holdings: mapped, totalValue: Math.round(totalValue * 100) / 100 });
});

app.get('/api/spending', (req, res) => {
  res.json({ monthly: monthlySpending, byCategory: spendingByCategory });
});

app.get('/api/settings', async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

app.post('/api/settings', async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await saveSetting(key, String(value));
  }
  res.json({ success: true, saved: Object.keys(req.body) });
});

app.get('/api/trades', async (req, res) => {
  const trades = await getTradeHistory();
  res.json({ trades });
});

app.post('/api/trade', async (req, res) => {
  const { action, symbol, name, shares, price } = req.body;
  if (!action || !symbol || !shares || !price) {
    return res.status(400).json({ error: 'Missing required fields: action, symbol, shares, price' });
  }
  if (!['buy', 'sell'].includes(action)) {
    return res.status(400).json({ error: 'Action must be "buy" or "sell"' });
  }
  if (Number(shares) <= 0 || Number(price) <= 0) {
    return res.status(400).json({ error: 'Shares and price must be positive numbers' });
  }
  try {
    const trade = await executeTrade({
      action,
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      shares: Number(shares),
      price: Number(price),
    });
    res.json({ success: true, trade });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Page Routes ---

// Dashboard
app.get('/', async (req, res) => {
  const accounts = await getAccounts();
  const { transactions } = await getTransactions({ limit: 8 });
  const portfolio = await getPortfolio();

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const { transactions: allTxns } = await getTransactions({ limit: 50 });
  const allIncome = allTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const allExpenses = allTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const portfolioTotal = portfolio.reduce((sum, h) => sum + h.shares * h.price, 0);
  const dayChange = portfolio.reduce((sum, h) => sum + h.shares * h.change, 0);
  const maxMonthly = Math.max(...monthlySpending.map(m => m.amount));
  const totalCategorySpend = spendingByCategory.reduce((s, c) => s + c.amount, 0);

  const accountIcons = {
    checking: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    savings: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    investment: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    credit: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  };

  const content = `
      <div class="summary-grid">
        <div class="summary-card">
          <div class="card-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
          <div class="card-label">Total Balance</div>
          <div class="card-value">$${fmt(totalBalance)}</div>
          <div class="card-change change-up"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> +2.4% from last month</div>
        </div>
        <div class="summary-card">
          <div class="card-icon green"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
          <div class="card-label">Income (90d)</div>
          <div class="card-value" style="color:var(--accent-green)">$${fmt(allIncome)}</div>
          <div class="card-change change-up"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> +5.1% from prior period</div>
        </div>
        <div class="summary-card">
          <div class="card-icon red"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg></div>
          <div class="card-label">Expenses (90d)</div>
          <div class="card-value">$${fmt(allExpenses)}</div>
          <div class="card-change change-down"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> -3.2% from prior period</div>
        </div>
        <div class="summary-card">
          <div class="card-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
          <div class="card-label">Investments</div>
          <div class="card-value">$${fmt(portfolioTotal)}</div>
          <div class="card-change ${dayChange >= 0 ? 'change-up' : 'change-down'}">
            ${dayChange >= 0
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'}
            ${fmtSign(dayChange)} today
          </div>
        </div>
      </div>

      <div class="content-grid wide">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Recent Transactions</span>
            <a class="card-action" href="/transactions">View All</a>
          </div>
          <div class="txn-list">${transactions.map(renderTxnRow).join('\n')}</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Accounts</span>
            <a class="card-action" href="/accounts">Manage</a>
          </div>
          <div class="card-body">
            <div class="account-list">
${accounts.map(a => {
  const balColor = a.balance >= 0 ? 'var(--text-primary)' : 'var(--accent-red)';
  return `              <div class="account-item">
                <div class="account-icon ${a.type}">${accountIcons[a.type]}</div>
                <div class="account-info">
                  <div class="account-name">${a.name}</div>
                  <div class="account-detail">${a.institution} ****${a.lastFour || a.last_four}</div>
                </div>
                <div class="account-balance" style="color:${balColor}">$${fmt(Math.abs(a.balance))}</div>
              </div>`;
}).join('\n')}
            </div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Monthly Spending</span>
            <span class="card-action">Last 6 months</span>
          </div>
          <div class="card-body">
            <div class="bar-chart">
${monthlySpending.map(m => {
  const pct = Math.round((m.amount / maxMonthly) * 100);
  return `              <div class="bar-group">
                <div class="bar-value">$${m.amount.toLocaleString()}</div>
                <div class="bar" style="height:${pct}%"></div>
                <div class="bar-label">${m.month}</div>
              </div>`;
}).join('\n')}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Spending by Category</span>
            <span class="card-action">This month</span>
          </div>
          <div class="card-body">
            <div class="category-list">
${spendingByCategory.map(c => {
  const pct = Math.round((c.amount / totalCategorySpend) * 100);
  return `              <div class="category-item">
                <div class="category-color" style="background:${c.color}"></div>
                <div class="category-name">${c.category}</div>
                <div class="category-bar-wrap"><div class="category-bar" style="width:${pct}%;background:${c.color}"></div></div>
                <div class="category-amount">$${c.amount.toLocaleString()}</div>
              </div>`;
}).join('\n')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Portfolio Holdings</span>
          <a class="card-action" href="/portfolio">View Details</a>
        </div>
        <div class="card-body" style="padding:12px 4px;">
          <table class="holdings-table">
            <thead><tr><th>Asset</th><th>Shares</th><th>Price</th><th>Value</th><th>Day Change</th><th>Allocation</th></tr></thead>
            <tbody>
${portfolio.map(h => {
  const value = h.shares * h.price;
  const dayChg = h.shares * h.change;
  const chgClass = dayChg >= 0 ? 'change-up' : 'change-down';
  return `              <tr>
                <td><div class="holding-symbol">${h.symbol}</div><div class="holding-name">${h.name}</div></td>
                <td style="color:var(--text-secondary)">${h.shares}</td>
                <td style="color:var(--text-secondary)">$${fmt(h.price)}</td>
                <td style="font-weight:600">$${fmt(value)}</td>
                <td class="${chgClass}" style="font-weight:500">${fmtSign(dayChg)}</td>
                <td><span class="alloc-bar-wrap"><span class="alloc-bar" style="width:${h.allocation}%"></span></span>${h.allocation}%</td>
              </tr>`;
}).join('\n')}
            </tbody>
          </table>
        </div>
      </div>`;

  res.send(pageWrapper('Dashboard', `Your financial overview for ${format(new Date(), 'MMMM yyyy')}`, content, 'dashboard'));
});

// Transactions page
app.get('/transactions', async (req, res) => {
  const { category } = req.query;
  const { transactions, total } = await getTransactions({ category, limit: 100 });

  const filterChips = ['All', ...categories].map(c => {
    const isActive = (c === 'All' && !category) || (category && c.toLowerCase() === category.toLowerCase());
    const href = c === 'All' ? '/transactions' : `/transactions?category=${encodeURIComponent(c)}`;
    return `<a class="filter-chip${isActive ? ' active' : ''}" href="${href}">${c}</a>`;
  }).join('');

  const content = `
    <div class="filter-bar">${filterChips}</div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">${category || 'All'} Transactions</span>
        <span class="card-action">${total} total</span>
      </div>
      <div class="txn-list">${transactions.map(t => {
        const statusBadge = t.status === 'pending'
          ? ' <span class="txn-status pending">pending</span>'
          : ' <span class="txn-status completed">completed</span>';
        return `<div class="txn-item">
          <div class="txn-icon ${t.icon}">${iconSVGs[t.icon] || iconSVGs.dollar}</div>
          <div class="txn-info">
            <div class="txn-merchant">${t.merchant}</div>
            <div class="txn-category">${t.category} &middot; ${t.account || 'N/A'}${statusBadge}</div>
          </div>
          <div class="txn-right">
            <div class="txn-amount ${t.amount >= 0 ? 'positive' : 'negative'}">${t.amount >= 0 ? '+' : ''}$${fmt(Math.abs(t.amount))}</div>
            <div class="txn-date">${t.date}</div>
          </div>
        </div>`;
      }).join('\n')}</div>
    </div>`;

  res.send(pageWrapper('Transactions', `${category ? category + ' transactions' : 'All your financial activity'}`, content, 'transactions'));
});

// Accounts page
app.get('/accounts', async (req, res) => {
  const accounts = await getAccounts();
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalAssets = accounts.filter(a => a.balance > 0).reduce((sum, a) => sum + a.balance, 0);
  const totalDebt = accounts.filter(a => a.balance < 0).reduce((sum, a) => sum + Math.abs(a.balance), 0);

  const accountIcons = {
    checking: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    savings: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    investment: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    credit: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  };

  const summaryCards = `
    <div class="summary-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="summary-card">
        <div class="card-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>
        <div class="card-label">Net Worth</div>
        <div class="card-value">$${fmt(totalBalance)}</div>
      </div>
      <div class="summary-card">
        <div class="card-icon green"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
        <div class="card-label">Total Assets</div>
        <div class="card-value" style="color:var(--accent-green)">$${fmt(totalAssets)}</div>
      </div>
      <div class="summary-card">
        <div class="card-icon red"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg></div>
        <div class="card-label">Total Debt</div>
        <div class="card-value" style="color:var(--accent-red)">$${fmt(totalDebt)}</div>
      </div>
    </div>`;

  const accountCards = accounts.map(a => {
    const balColor = a.balance >= 0 ? 'var(--text-primary)' : 'var(--accent-red)';
    const pctOfTotal = Math.abs(a.balance / totalAssets * 100).toFixed(1);
    return `
      <div class="account-detail-card">
        <div class="account-detail-header">
          <div class="account-detail-icon account-icon ${a.type}">${accountIcons[a.type]}</div>
          <div>
            <div class="account-detail-name">${a.name}</div>
            <div class="account-detail-sub">${a.institution} &middot; ****${a.lastFour || a.last_four}</div>
          </div>
        </div>
        <div class="account-detail-balance" style="color:${balColor}">${a.balance < 0 ? '-' : ''}$${fmt(Math.abs(a.balance))}</div>
        <div class="account-detail-meta">
          <div class="meta-item">Type: <span class="meta-value">${a.type.charAt(0).toUpperCase() + a.type.slice(1)}</span></div>
          <div class="meta-item">Currency: <span class="meta-value">${a.currency}</span></div>
          <div class="meta-item">Portfolio share: <span class="meta-value">${pctOfTotal}%</span></div>
        </div>
      </div>`;
  }).join('');

  const content = summaryCards + accountCards;
  res.send(pageWrapper('Accounts', `${accounts.length} linked accounts`, content, 'accounts'));
});

// Portfolio page
app.get('/portfolio', async (req, res) => {
  const holdings = await getPortfolio();
  const totalValue = holdings.reduce((sum, h) => sum + h.shares * h.price, 0);
  const totalDayChange = holdings.reduce((sum, h) => sum + h.shares * h.change, 0);
  const totalDayChangePct = (totalDayChange / (totalValue - totalDayChange) * 100);

  const summaryCards = `
    <div class="summary-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="summary-card">
        <div class="card-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
        <div class="card-label">Total Value</div>
        <div class="card-value">$${fmt(totalValue)}</div>
      </div>
      <div class="summary-card">
        <div class="card-icon ${totalDayChange >= 0 ? 'green' : 'red'}">
          ${totalDayChange >= 0
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>'}
        </div>
        <div class="card-label">Day Change</div>
        <div class="card-value ${totalDayChange >= 0 ? 'change-up' : 'change-down'}">${fmtSign(totalDayChange)}</div>
        <div class="card-change ${totalDayChange >= 0 ? 'change-up' : 'change-down'}">${totalDayChangePct >= 0 ? '+' : ''}${totalDayChangePct.toFixed(2)}%</div>
      </div>
      <div class="summary-card">
        <div class="card-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div>
        <div class="card-label">Holdings</div>
        <div class="card-value">${holdings.length}</div>
        <div class="card-change" style="color:var(--text-muted)">${holdings.filter(h => h.change > 0).length} up, ${holdings.filter(h => h.change < 0).length} down</div>
      </div>
    </div>`;

  const table = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">All Holdings</span>
        <span class="card-action">Sorted by allocation</span>
      </div>
      <div class="card-body" style="padding:12px 4px;">
        <table class="holdings-table">
          <thead><tr><th>Asset</th><th>Shares</th><th>Price</th><th>Value</th><th>Day Change</th><th>Allocation</th></tr></thead>
          <tbody>
${holdings.map(h => {
  const value = h.shares * h.price;
  const dayChg = h.shares * h.change;
  const chgClass = dayChg >= 0 ? 'change-up' : 'change-down';
  return `            <tr>
              <td><div class="holding-symbol">${h.symbol}</div><div class="holding-name">${h.name}</div></td>
              <td style="color:var(--text-secondary)">${h.shares}</td>
              <td style="color:var(--text-secondary)">$${fmt(h.price)}</td>
              <td style="font-weight:600">$${fmt(value)}</td>
              <td class="${chgClass}" style="font-weight:500">${fmtSign(dayChg)}</td>
              <td><span class="alloc-bar-wrap"><span class="alloc-bar" style="width:${h.allocation}%"></span></span>${h.allocation}%</td>
            </tr>`;
}).join('\n')}
          </tbody>
        </table>
      </div>
    </div>`;

  // Allocation breakdown
  const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b'];
  const allocationChart = `
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <span class="card-title">Allocation Breakdown</span>
      </div>
      <div class="card-body">
        <div class="category-list">
${holdings.map((h, i) => {
  const value = h.shares * h.price;
  const color = colors[i % colors.length];
  return `          <div class="category-item">
            <div class="category-color" style="background:${color}"></div>
            <div class="category-name">${h.symbol} - ${h.name}</div>
            <div class="category-bar-wrap"><div class="category-bar" style="width:${h.allocation}%;background:${color}"></div></div>
            <div class="category-amount">$${fmt(value)}</div>
          </div>`;
}).join('\n')}
        </div>
      </div>
    </div>`;

  const content = summaryCards + table + allocationChart;
  res.send(pageWrapper('Portfolio', 'Your investment holdings and performance', content, 'portfolio'));
});

// Trade page
app.get('/trade', async (req, res) => {
  const holdings = await getPortfolio();
  const trades = await getTradeHistory();
  const successMsg = req.query.success;
  const errorMsg = req.query.error;
  const defaultAction = req.query.action || 'buy';

  const msgHtml = successMsg
    ? `<div class="trade-msg success">${decodeURIComponent(successMsg)}</div>`
    : errorMsg
      ? `<div class="trade-msg error">${decodeURIComponent(errorMsg)}</div>`
      : '';

  const holdingOptions = holdings
    .filter(h => h.symbol !== 'Cash')
    .map(h => `<option value="${h.symbol}" data-name="${h.name}" data-price="${h.price}" data-shares="${h.shares}">${h.symbol} - ${h.name}</option>`)
    .join('');

  const tradeForm = `
    <div class="trade-form-card">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;">Place Order</h3>
      ${msgHtml}
      <form method="POST" action="/trade" id="tradeForm">
        <div class="trade-toggle">
          <button type="button" class="trade-toggle-btn ${defaultAction === 'buy' ? 'active-buy' : ''}" onclick="setAction('buy')" id="btnBuy">Buy</button>
          <button type="button" class="trade-toggle-btn ${defaultAction === 'sell' ? 'active-sell' : ''}" onclick="setAction('sell')" id="btnSell">Sell</button>
        </div>
        <input type="hidden" name="action" id="tradeAction" value="${defaultAction}">

        <div class="form-group">
          <label class="form-label">Symbol</label>
          <input class="form-input" type="text" name="symbol" id="symbolInput" placeholder="e.g. AAPL" required
                 list="holdingsList" autocomplete="off">
          <datalist id="holdingsList">${holdingOptions}</datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Name</label>
          <input class="form-input" type="text" name="name" id="nameInput" placeholder="Company name (optional)">
        </div>
        <div class="form-group">
          <label class="form-label">Shares</label>
          <input class="form-input" type="number" name="shares" id="sharesInput" placeholder="0" min="0.0001" step="any" required>
        </div>
        <div class="form-group">
          <label class="form-label">Price per Share ($)</label>
          <input class="form-input" type="number" name="price" id="priceInput" placeholder="0.00" min="0.01" step="any" required>
        </div>
        <div class="trade-summary">
          <div class="trade-summary-row"><span style="color:var(--text-muted)">Shares</span><span id="summShares">0</span></div>
          <div class="trade-summary-row"><span style="color:var(--text-muted)">Price</span><span id="summPrice">$0.00</span></div>
          <div class="trade-summary-row total"><span>Estimated Total</span><span id="summTotal">$0.00</span></div>
        </div>
        <button type="submit" class="${defaultAction === 'sell' ? 'btn-sell' : 'btn-buy'}" id="submitBtn" style="margin-top:16px">
          ${defaultAction === 'sell' ? 'Sell' : 'Buy'} Shares
        </button>
      </form>
    </div>`;

  const tradeHistoryHtml = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Trade History</span>
        <span class="card-action">${trades.length} trades</span>
      </div>
      <div class="card-body" style="padding:0;">
        ${trades.length === 0
          ? '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:14px;">No trades yet. Place your first order!</div>'
          : trades.map(t => {
              const dateStr = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = new Date(t.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              return `<div class="trade-history-item">
                <span class="trade-badge ${t.action}">${t.action}</span>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:14px;font-weight:500;color:var(--text-primary)">${t.symbol}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${t.shares} shares @ $${fmt(t.price)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:14px;font-weight:600;color:var(--text-primary)">$${fmt(t.total)}</div>
                  <div style="font-size:12px;color:var(--text-muted)">${dateStr} ${timeStr}</div>
                </div>
              </div>`;
            }).join('')}
      </div>
    </div>`;

  const holdingsQuickRef = `
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title">Your Holdings</span>
        <a class="card-action" href="/portfolio">View All</a>
      </div>
      <div class="card-body" style="padding:4px 0;">
        ${holdings.filter(h => h.symbol !== 'Cash').map(h => `
          <div style="display:flex;align-items:center;padding:8px 20px;font-size:13px;">
            <span style="font-weight:600;width:60px;color:var(--text-primary)">${h.symbol}</span>
            <span style="flex:1;color:var(--text-muted)">${h.shares} shares</span>
            <span style="color:var(--text-secondary)">$${fmt(h.price)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;

  const script = `
    <script>
      function setAction(action) {
        document.getElementById('tradeAction').value = action;
        const btnBuy = document.getElementById('btnBuy');
        const btnSell = document.getElementById('btnSell');
        const submitBtn = document.getElementById('submitBtn');
        btnBuy.className = 'trade-toggle-btn' + (action === 'buy' ? ' active-buy' : '');
        btnSell.className = 'trade-toggle-btn' + (action === 'sell' ? ' active-sell' : '');
        submitBtn.className = action === 'sell' ? 'btn-sell' : 'btn-buy';
        submitBtn.textContent = (action === 'sell' ? 'Sell' : 'Buy') + ' Shares';
      }

      function updateSummary() {
        var shares = parseFloat(document.getElementById('sharesInput').value) || 0;
        var price = parseFloat(document.getElementById('priceInput').value) || 0;
        var total = shares * price;
        document.getElementById('summShares').textContent = shares;
        document.getElementById('summPrice').textContent = '$' + price.toFixed(2);
        document.getElementById('summTotal').textContent = '$' + total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
      }

      document.getElementById('sharesInput').addEventListener('input', updateSummary);
      document.getElementById('priceInput').addEventListener('input', updateSummary);

      document.getElementById('symbolInput').addEventListener('change', function() {
        var opts = document.getElementById('holdingsList').options;
        for (var i = 0; i < opts.length; i++) {
          if (opts[i].value === this.value) {
            document.getElementById('nameInput').value = opts[i].dataset.name;
            document.getElementById('priceInput').value = opts[i].dataset.price;
            updateSummary();
            break;
          }
        }
      });
    </script>`;

  const content = `<div class="trade-layout">${tradeForm}<div>${tradeHistoryHtml}${holdingsQuickRef}</div></div>`;
  res.send(pageWrapper('Trade', 'Buy and sell stocks', content, 'trade', script));
});

app.post('/trade', async (req, res) => {
  const { action, symbol, name, shares, price } = req.body;
  try {
    await executeTrade({
      action,
      symbol: symbol.toUpperCase(),
      name: name || symbol.toUpperCase(),
      shares: Number(shares),
      price: Number(price),
    });
    const msg = `Successfully ${action === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${symbol.toUpperCase()} at $${Number(price).toFixed(2)}`;
    res.redirect(`/trade?success=${encodeURIComponent(msg)}`);
  } catch (err) {
    res.redirect(`/trade?error=${encodeURIComponent(err.message)}&action=${action}`);
  }
});

// Analytics page
app.get('/analytics', async (req, res) => {
  const { transactions: allTxns } = await getTransactions({ limit: 200 });
  const totalIncome = allTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = allTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
  const maxMonthly = Math.max(...monthlySpending.map(m => m.amount));
  const totalCategorySpend = spendingByCategory.reduce((s, c) => s + c.amount, 0);
  const avgMonthly = monthlySpending.reduce((s, m) => s + m.amount, 0) / monthlySpending.length;

  // Spending per merchant
  const merchantTotals = {};
  allTxns.filter(t => t.amount < 0).forEach(t => {
    merchantTotals[t.merchant] = (merchantTotals[t.merchant] || 0) + Math.abs(t.amount);
  });
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxMerchant = topMerchants.length > 0 ? topMerchants[0][1] : 1;

  const summaryCards = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="card-icon green"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
        <div class="card-label">Total Income</div>
        <div class="card-value" style="color:var(--accent-green)">$${fmt(totalIncome)}</div>
      </div>
      <div class="summary-card">
        <div class="card-icon red"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg></div>
        <div class="card-label">Total Expenses</div>
        <div class="card-value">$${fmt(totalExpenses)}</div>
      </div>
      <div class="summary-card">
        <div class="card-icon blue"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <div class="card-label">Savings Rate</div>
        <div class="card-value">${savingsRate.toFixed(1)}%</div>
      </div>
      <div class="summary-card">
        <div class="card-icon purple"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
        <div class="card-label">Avg Monthly Spend</div>
        <div class="card-value">$${fmt(avgMonthly)}</div>
      </div>
    </div>`;

  const charts = `
    <div class="content-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Monthly Spending Trend</span>
          <span class="card-action">Last 6 months</span>
        </div>
        <div class="card-body">
          <div class="bar-chart">
${monthlySpending.map(m => {
  const pct = Math.round((m.amount / maxMonthly) * 100);
  return `            <div class="bar-group">
              <div class="bar-value">$${m.amount.toLocaleString()}</div>
              <div class="bar" style="height:${pct}%"></div>
              <div class="bar-label">${m.month}</div>
            </div>`;
}).join('\n')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Spending by Category</span>
          <span class="card-action">This month</span>
        </div>
        <div class="card-body">
          <div class="category-list">
${spendingByCategory.map(c => {
  const pct = Math.round((c.amount / totalCategorySpend) * 100);
  return `            <div class="category-item">
              <div class="category-color" style="background:${c.color}"></div>
              <div class="category-name">${c.category}</div>
              <div class="category-bar-wrap"><div class="category-bar" style="width:${pct}%;background:${c.color}"></div></div>
              <div class="category-amount">$${c.amount.toLocaleString()}</div>
            </div>`;
}).join('\n')}
          </div>
        </div>
      </div>
    </div>`;

  const merchantColors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
  const topMerchantsCard = `
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <span class="card-title">Top Merchants by Spend</span>
      </div>
      <div class="card-body">
        <div class="category-list">
${topMerchants.map(([name, amount], i) => {
  const pct = Math.round((amount / maxMerchant) * 100);
  const color = merchantColors[i % merchantColors.length];
  return `          <div class="category-item">
            <div class="category-color" style="background:${color}"></div>
            <div class="category-name">${name}</div>
            <div class="category-bar-wrap"><div class="category-bar" style="width:${pct}%;background:${color}"></div></div>
            <div class="category-amount">$${fmt(amount)}</div>
          </div>`;
}).join('\n')}
        </div>
      </div>
    </div>`;

  const content = summaryCards + charts + topMerchantsCard;
  res.send(pageWrapper('Analytics', 'Spending insights and financial trends', content, 'analytics'));
});

// Settings page
app.get('/settings', async (req, res) => {
  const settings = await getSettings();
  const saved = req.query.saved === '1';

  const content = `
    <div class="save-banner${saved ? ' show' : ''}">Settings saved successfully.</div>
    <form method="POST" action="/settings">
      <div class="content-grid">
        <div class="card">
          <div class="card-header"><span class="card-title">Profile</span></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input class="form-input" type="text" name="display_name" value="${settings.display_name || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Currency</label>
              <select class="form-select" name="currency">
                <option value="USD"${settings.currency === 'USD' ? ' selected' : ''}>USD - US Dollar</option>
                <option value="EUR"${settings.currency === 'EUR' ? ' selected' : ''}>EUR - Euro</option>
                <option value="GBP"${settings.currency === 'GBP' ? ' selected' : ''}>GBP - British Pound</option>
                <option value="JPY"${settings.currency === 'JPY' ? ' selected' : ''}>JPY - Japanese Yen</option>
                <option value="CAD"${settings.currency === 'CAD' ? ' selected' : ''}>CAD - Canadian Dollar</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Email Reports</label>
              <select class="form-select" name="email_reports">
                <option value="daily"${settings.email_reports === 'daily' ? ' selected' : ''}>Daily</option>
                <option value="weekly"${settings.email_reports === 'weekly' ? ' selected' : ''}>Weekly</option>
                <option value="monthly"${settings.email_reports === 'monthly' ? ' selected' : ''}>Monthly</option>
                <option value="never"${settings.email_reports === 'never' ? ' selected' : ''}>Never</option>
              </select>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Notifications</span></div>
          <div class="card-body">
            <div class="toggle-row">
              <div>
                <div class="toggle-label">Push Notifications</div>
                <div class="toggle-desc">Receive alerts for large transactions</div>
              </div>
              <input type="hidden" name="notifications" value="false">
              <button type="button" class="toggle ${settings.notifications === 'true' ? 'on' : ''}" onclick="this.classList.toggle('on');this.previousElementSibling.value=this.classList.contains('on')"></button>
            </div>
            <div class="toggle-row">
              <div>
                <div class="toggle-label">Budget Alerts</div>
                <div class="toggle-desc">Notify when nearing budget limits</div>
              </div>
              <input type="hidden" name="budget_alerts" value="false">
              <button type="button" class="toggle ${settings.budget_alerts === 'true' ? 'on' : ''}" onclick="this.classList.toggle('on');this.previousElementSibling.value=this.classList.contains('on')"></button>
            </div>
            <div class="toggle-row">
              <div>
                <div class="toggle-label">Security Alerts</div>
                <div class="toggle-desc">Unusual activity warnings</div>
              </div>
              <input type="hidden" name="security_alerts" value="false">
              <button type="button" class="toggle ${(settings.security_alerts || 'true') === 'true' ? 'on' : ''}" onclick="this.classList.toggle('on');this.previousElementSibling.value=this.classList.contains('on')"></button>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;">
        <button type="submit" class="btn-primary">Save Settings</button>
        <a href="/settings" class="btn-outline">Reset</a>
      </div>
      <div style="margin-top:28px;padding:16px 20px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:13px;color:var(--text-muted);">
        Data storage: ${dbAvailable ? '<span style="color:var(--accent-green)">PostgreSQL connected</span> — settings are persisted to database.' : '<span style="color:var(--accent-amber)">Database offline</span> — settings are stored in memory only.'}
      </div>
    </form>`;

  res.send(pageWrapper('Settings', 'Manage your preferences', content, 'settings'));
});

app.post('/settings', async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await saveSetting(key, String(value));
  }
  res.redirect('/settings?saved=1');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`FinView running on port ${PORT}`);
    console.log(`Database: ${dbAvailable ? 'connected' : 'offline (using in-memory data)'}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
