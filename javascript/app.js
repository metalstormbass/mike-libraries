const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');
const redis = require('redis');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis client setup
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Routes
app.get('/', (req, res) => {
  // Redirect to dependencies function
  showDependencies(req, res);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'javascript-app' });
});

app.get('/dependencies', (req, res) => {
  showDependencies(req, res);
});

const showDependencies = (req, res) => {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const allDeps = { ...dependencies, ...devDependencies };
    const depCount = Object.keys(dependencies).length;
    const devDepCount = Object.keys(devDependencies).length;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>JavaScript Dependencies</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          h1 {
            color: #68A063;
            border-bottom: 3px solid #3C873A;
            padding-bottom: 10px;
          }
          .info {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #3C873A;
            margin-bottom: 15px;
          }
          .deps-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
          }
          .dep-card {
            background-color: white;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #68A063;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .dep-card.dev {
            border-left-color: #CC6699;
          }
          .dep-name {
            font-weight: bold;
            color: #3C873A;
            font-size: 16px;
          }
          .dep-version {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
          }
          .count {
            color: #3C873A;
            font-weight: bold;
            font-size: 24px;
          }
        </style>
      </head>
      <body>
        <h1>📦 JavaScript/Node.js Express Application Dependencies</h1>
        <div class="info">
          <p><strong>Framework:</strong> Express ${packageJson.dependencies?.express || '4.x'}</p>
          <p><strong>Production Dependencies:</strong> <span class="count">${depCount}</span></p>
          <p><strong>Dev Dependencies:</strong> <span class="count">${devDepCount}</span></p>
          <p><strong>Package Manager:</strong> npm</p>
        </div>

        <div class="section">
          <div class="section-title">Production Dependencies</div>
          <div class="deps-grid">
    `;

    Object.entries(dependencies).forEach(([name, version]) => {
      html += `
        <div class="dep-card">
          <div class="dep-name">${name}</div>
          <div class="dep-version">Version: ${version}</div>
        </div>
      `;
    });

    html += `
          </div>
        </div>

        <div class="section">
          <div class="section-title">Development Dependencies</div>
          <div class="deps-grid">
    `;

    Object.entries(devDependencies).forEach(([name, version]) => {
      html += `
        <div class="dep-card dev">
          <div class="dep-name">${name}</div>
          <div class="dep-version">Version: ${version}</div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];
  res.json({ users });
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({
    message: 'User created',
    user: { id: Date.now(), name, email }
  });
});

app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter required' });
    }
    const response = await axios.get(url);
    res.json({ data: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

app.get('/api/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await redisClient.get(key);
    res.json({ key, value });
  } catch (error) {
    res.status(500).json({ error: 'Cache read failed' });
  }
});

app.post('/api/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await redisClient.set(key, value);
    res.json({ message: `Cached ${key}` });
  } catch (error) {
    res.status(500).json({ error: 'Cache write failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const startServer = async () => {
  // Redis connection is optional - disable if Redis is not available
  // try {
  //   await redisClient.connect();
  //   console.log('Redis connected');
  // } catch (err) {
  //   console.log('Redis connection failed, continuing without cache');
  // }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

module.exports = app;
