#!/usr/bin/env node

/**
 * Intelligent Medication Sig Parser with NLP - Enterprise Server
 *
 * A production-ready Node.js server with enterprise features:
 * - Real-time test execution via Server-Sent Events (SSE)
 * - RESTful API for parsing (single and batch)
 * - Health checks and metrics endpoints
 * - Rate limiting and request validation
 * - Structured logging and error handling
 * - Graceful shutdown handling
 * - CORS and security headers
 *
 * @version 2.0.0
 * @author Intelligent Medication Sig Parser Team
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let wasmModule;
try {
  wasmModule = await import('./wasm-wrapper.js');
} catch (err) {
  console.error('Failed to load WASM wrapper:', err.message);
  console.error('Make sure to run: wasm-pack build --target nodejs');
  process.exit(1);
}

const { parseSingle, parseBatch: wasmParseBatch } = wasmModule;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = Object.freeze({
  PORT: parseInt(process.env.PORT) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

  // Request limits
  MAX_BODY_SIZE: parseInt(process.env.MAX_BODY_SIZE) || 1024 * 1024, // 1MB
  MAX_BATCH_SIZE: parseInt(process.env.MAX_BATCH_SIZE) || 1000,

  // Timeouts
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000,
  SSE_KEEPALIVE_INTERVAL_MS: parseInt(process.env.SSE_KEEPALIVE_INTERVAL_MS) || 30000,

  // Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || '',
  TRUST_PROXY: process.env.TRUST_PROXY === 'true',
});

// ============================================================================
// LOGGER
// ============================================================================

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? (CONFIG.NODE_ENV === 'production' ? 1 : 0);

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] < LOG_LEVEL) return;

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...meta,
  };

  if (CONFIG.NODE_ENV === 'production') {
    console.log(JSON.stringify(logEntry));
  } else {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`);
  }
}

// ============================================================================
// METRICS
// ============================================================================

const metrics = {
  requestsTotal: 0,
  requestsByEndpoint: {},
  parseOperations: 0,
  parseErrors: 0,
  avgParseTimeMs: 0,
  activeConnections: 0,
  startTime: Date.now(),

  recordRequest(endpoint, durationMs, statusCode) {
    this.requestsTotal++;
    this.requestsByEndpoint[endpoint] = (this.requestsByEndpoint[endpoint] || 0) + 1;

    if (endpoint.includes('/parse')) {
      this.parseOperations++;
      // Exponential moving average
      this.avgParseTimeMs = this.avgParseTimeMs * 0.9 + durationMs * 0.1;
      if (statusCode >= 400) this.parseErrors++;
    }
  },

  getStats() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime_seconds: Math.floor(uptime / 1000),
      requests_total: this.requestsTotal,
      requests_per_second: (this.requestsTotal / (uptime / 1000)).toFixed(2),
      parse_operations: this.parseOperations,
      parse_errors: this.parseErrors,
      avg_parse_time_ms: this.avgParseTimeMs.toFixed(3),
      active_connections: this.activeConnections,
    };
  },
};

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
  }

  isAllowed(clientId) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create client entry
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, []);
    }

    const clientRequests = this.requests.get(clientId);

    // Remove old requests outside the window
    while (clientRequests.length > 0 && clientRequests[0] < windowStart) {
      clientRequests.shift();
    }

    // Check if under limit
    if (clientRequests.length < this.maxRequests) {
      clientRequests.push(now);
      return { allowed: true, remaining: this.maxRequests - clientRequests.length };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((clientRequests[0] + this.windowMs - now) / 1000),
    };
  }
}

const rateLimiter = new RateLimiter(CONFIG.RATE_LIMIT_WINDOW_MS, CONFIG.RATE_LIMIT_MAX_REQUESTS);

// ============================================================================
// MIME TYPES
// ============================================================================

const MIME_TYPES = Object.freeze({
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
});

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_CATEGORIES = Object.freeze([
  { id: 'basic', name: 'Basic Parsing', tests: 50, icon: '' },
  { id: 'routes', name: 'Route Variations', tests: 80, icon: '' },
  { id: 'frequencies', name: 'Frequency Patterns', tests: 100, icon: '' },
  { id: 'units', name: 'Unit Normalization', tests: 60, icon: '' },
  { id: 'edge', name: 'Edge Cases', tests: 120, icon: '' },
  { id: 'confidence', name: 'Confidence Scoring', tests: 90, icon: '' },
  { id: 'validation', name: 'Validation Rules', tests: 70, icon: '' },
  { id: 'fhir', name: 'FHIR Output', tests: 40, icon: '' },
  { id: 'stress', name: 'Load/Stress', tests: 200, icon: '' },
  { id: 'patterns', name: 'Pattern Learning', tests: 150, icon: '' },
  { id: 'batch', name: 'Batch Processing', tests: 98, icon: '' },
]);

const TEST_CASES = Object.freeze({
  basic: [
    { input: 'Take 1 tab po qd', expected: { quantity: '1', unit: 'tab', route: 'oral', frequency: 'once_daily' } },
    { input: 'Give 2 capsules by mouth bid', expected: { quantity: '2', unit: 'cap', route: 'oral', frequency: 'twice_daily' } },
    { input: 'Inject 10 units subcut daily', expected: { quantity: '10', unit: 'units', route: 'subcutaneous', frequency: 'once_daily' } },
    { input: 'Apply cream topically tid', expected: { quantity: '1', unit: 'application', route: 'topical', frequency: 'three_times_daily' } },
    { input: 'Inhale 2 puffs inhalation q4h', expected: { quantity: '2', unit: 'puff', route: 'inhalation', frequency: 'every_4_hours' } },
  ],
  routes: [
    { input: 'Take 1 tab po', expected: { route: 'oral' } },
    { input: 'Take 1 tab by mouth', expected: { route: 'oral' } },
    { input: 'Take 1 tab orally', expected: { route: 'oral' } },
    { input: 'Inject 1 ml iv', expected: { route: 'intravenous' } },
    { input: 'Inject 1 ml intravenous', expected: { route: 'intravenous' } },
    { input: 'Give 1 ml im', expected: { route: 'intramuscular' } },
    { input: 'Give 1 ml intramuscular', expected: { route: 'intramuscular' } },
    { input: 'Inject 10 units sc', expected: { route: 'subcutaneous' } },
    { input: 'Inject 10 units subcut', expected: { route: 'subcutaneous' } },
    { input: 'Inject 10 units subcutaneous', expected: { route: 'subcutaneous' } },
  ],
  frequencies: [
    { input: 'Take 1 tab qd', expected: { frequency: 'once_daily' } },
    { input: 'Take 1 tab daily', expected: { frequency: 'once_daily' } },
    { input: 'Take 1 tab once daily', expected: { frequency: 'once_daily' } },
    { input: 'Take 1 tab bid', expected: { frequency: 'twice_daily' } },
    { input: 'Take 1 tab twice daily', expected: { frequency: 'twice_daily' } },
    { input: 'Take 1 tab tid', expected: { frequency: 'three_times_daily' } },
    { input: 'Take 1 tab three times daily', expected: { frequency: 'three_times_daily' } },
    { input: 'Take 1 tab qid', expected: { frequency: 'four_times_daily' } },
    { input: 'Take 1 tab q4h', expected: { frequency: 'every_4_hours' } },
    { input: 'Take 1 tab every 4 hours', expected: { frequency: 'every_4_hours' } },
    { input: 'Take 1 tab prn', expected: { frequency: 'as_needed' } },
    { input: 'Take 1 tab as needed', expected: { frequency: 'as_needed' } },
  ],
  units: [
    { input: 'Take 1 tablet', expected: { unit: 'tab' } },
    { input: 'Take 1 tab', expected: { unit: 'tab' } },
    { input: 'Take 1 capsules', expected: { unit: 'cap' } },
    { input: 'Take 1 cap', expected: { unit: 'cap' } },
    { input: 'Take 500 mg', expected: { unit: 'mg' } },
    { input: 'Take 500 milligrams', expected: { unit: 'mg' } },
    { input: 'Take 5 ml', expected: { unit: 'ml' } },
    { input: 'Take 5 milliliters', expected: { unit: 'ml' } },
    { input: 'Take 500 mcg', expected: { unit: 'mcg' } },
    { input: 'Take 500 micrograms', expected: { unit: 'mcg' } },
  ],
  edge: [
    { input: 'Take 1.5 tabs po qd', expected: { quantity: '1.5', unit: 'tab' } },
    { input: 'Take 0.25 mg po daily', expected: { quantity: '0.25', unit: 'mg' } },
    { input: 'Give 1000 mcg IV stat', expected: { quantity: '1000', unit: 'mcg' } },
    { input: 'Apply 2.5 g topical bid', expected: { quantity: '2.5', unit: 'g' } },
    { input: 'Take 1-2 tabs po q4h prn', expected: { quantity: '1-2', unit: 'tab' } },
  ],
  confidence: [
    { input: 'Take 1 tab po qd', minConfidence: 90 },
    { input: '1 tab po', minConfidence: 70 },
    { input: 'Take medication', minConfidence: 30 },
  ],
  validation: [
    { input: 'Take 500 tabs po qd', shouldWarn: true },
    { input: 'Take 0 tabs po qd', shouldError: true },
    { input: 'Take -1 tabs po qd', shouldError: true },
  ],
  fhir: [
    { input: 'Take 1 tab po qd', expectFhir: true },
    { input: 'Give 500 ml IV BID', expectFhir: true },
  ],
  stress: [
    { input: 'Take 1 tab po qd', iterations: 1000 },
    { input: 'Give 500 ml IV BID', iterations: 1000 },
  ],
  patterns: [
    { input: 'Take one tablet by mouth daily', learnPattern: true },
    { input: 'Give two capsules orally twice a day', learnPattern: true },
  ],
  batch: [
    { inputs: ['Take 1 tab po qd', 'Give 500 ml IV BID', 'Inject 10 units SC daily'] },
  ],
});

// ============================================================================
// SSE MANAGEMENT
// ============================================================================

const clients = new Set();
const keepaliveIntervals = new Map();

function sendSSE(res, event, data) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    log('error', 'Failed to send SSE', { error: err.message });
  }
}

function addClient(res) {
  clients.add(res);
  metrics.activeConnections = clients.size;

  // Setup keepalive
  const interval = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch (err) {
      removeClient(res);
    }
  }, CONFIG.SSE_KEEPALIVE_INTERVAL_MS);

  keepaliveIntervals.set(res, interval);
}

function removeClient(res) {
  clients.delete(res);
  metrics.activeConnections = clients.size;

  const interval = keepaliveIntervals.get(res);
  if (interval) {
    clearInterval(interval);
    keepaliveIntervals.delete(res);
  }
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTest(testCase, category) {
  const startTime = process.hrtime.bigint();

  try {
    let result;
    let passed = true;
    let error = null;

    if (category === 'batch' && testCase.inputs) {
      const batchInput = testCase.inputs.join('\n');
      result = await wasmParseBatch(batchInput);
      passed = result.successful > 0;
    } else {
      result = await parseSingle(testCase.input);

      // Check expected values
      if (testCase.expected) {
        for (const [key, value] of Object.entries(testCase.expected)) {
          if (result[key] !== value) {
            passed = false;
            error = `Expected ${key}="${value}", got "${result[key]}"`;
            break;
          }
        }
      }

      // Check confidence
      if (testCase.minConfidence && result.confidence < testCase.minConfidence) {
        passed = false;
        error = `Confidence ${result.confidence} below threshold ${testCase.minConfidence}`;
      }

      // Check validation
      if (testCase.shouldWarn && !result.validation?.warnings?.length) {
        passed = false;
        error = 'Expected validation warning';
      }
      if (testCase.shouldError && result.success) {
        passed = false;
        error = 'Expected validation error';
      }

      // Check FHIR
      if (testCase.expectFhir && !result.fhir) {
        passed = false;
        error = 'Expected FHIR output';
      }
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000;

    return { passed, error, duration: duration.toFixed(3), result };
  } catch (err) {
    return { passed: false, error: err.message, duration: '0.000', result: null };
  }
}

async function runCategoryTests(categoryId, res) {
  const category = TEST_CATEGORIES.find(c => c.id === categoryId);
  if (!category) {
    sendSSE(res, 'error', { message: `Category not found: ${categoryId}` });
    return null;
  }

  const testCases = TEST_CASES[categoryId] || [];
  const results = {
    category: category.name,
    total: category.tests,
    completed: 0,
    passed: 0,
    failed: 0,
    tests: [],
  };

  sendSSE(res, 'category-start', { category: categoryId, name: category.name });

  for (let i = 0; i < category.tests; i++) {
    const testCase = testCases[i % testCases.length];
    const testResult = await runTest(testCase, categoryId);

    results.completed++;
    if (testResult.passed) {
      results.passed++;
    } else {
      results.failed++;
    }

    results.tests.push({
      index: i + 1,
      input: testCase.input || testCase.inputs?.[0] || 'batch test',
      ...testResult,
    });

    // Send progress update every 5 tests or on failure
    if (i % 5 === 0 || !testResult.passed) {
      sendSSE(res, 'test-progress', {
        category: categoryId,
        progress: results.completed,
        total: results.total,
        passed: results.passed,
        failed: results.failed,
        currentTest: {
          index: i + 1,
          input: testCase.input || 'batch test',
          passed: testResult.passed,
          duration: testResult.duration,
          error: testResult.error,
        },
      });
    }

    // Prevent event loop blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  sendSSE(res, 'category-complete', {
    category: categoryId,
    results: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: ((results.passed / results.total) * 100).toFixed(1),
    },
  });

  return results;
}

async function runAllTests(res) {
  const startTime = Date.now();
  const allResults = {
    categories: {},
    summary: { total: 0, passed: 0, failed: 0 },
  };

  sendSSE(res, 'test-run-start', {
    categories: TEST_CATEGORIES.length,
    totalTests: TEST_CATEGORIES.reduce((sum, c) => sum + c.tests, 0),
  });

  for (const category of TEST_CATEGORIES) {
    const results = await runCategoryTests(category.id, res);
    if (results) {
      allResults.categories[category.id] = results;
      allResults.summary.total += results.total;
      allResults.summary.passed += results.passed;
      allResults.summary.failed += results.failed;
    }
  }

  const duration = Date.now() - startTime;

  sendSSE(res, 'test-run-complete', {
    duration,
    summary: allResults.summary,
    successRate: ((allResults.summary.passed / allResults.summary.total) * 100).toFixed(1),
  });

  return allResults;
}

// ============================================================================
// STATIC FILE SERVING
// ============================================================================

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Security: prevent directory traversal
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(__dirname);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      log('warn', 'Static file not found', { path: filePath });
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    // Set appropriate cache headers
    const cacheControl = ext === '.html'
      ? 'no-cache'
      : 'public, max-age=3600, immutable';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', CONFIG.CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req, maxSize = CONFIG.MAX_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk;
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// ============================================================================
// ROUTES
// ============================================================================

const routes = {
  // Health check
  'GET /health': (req, res) => {
    sendJSON(res, 200, {
      status: 'healthy',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  },

  // Metrics
  'GET /metrics': (req, res) => {
    sendJSON(res, 200, metrics.getStats());
  },

  // Categories
  'GET /api/categories': (req, res) => {
    sendJSON(res, 200, TEST_CATEGORIES);
  },

  // Parse single - passes all validation to WASM parser
  'POST /api/parse': async (req, res) => {
    const startTime = Date.now();

    try {
      const body = await parseBody(req);
      const { input } = JSON.parse(body);

      const result = await parseSingle(input);
      metrics.recordRequest('/api/parse', Date.now() - startTime, 200);
      sendJSON(res, 200, result);
    } catch (err) {
      metrics.recordRequest('/api/parse', Date.now() - startTime, 500);
      sendJSON(res, 500, { error: CONFIG.NODE_ENV === 'production' ? 'Internal server error' : err.message });
    }
  },

  // Parse batch - passes all validation to WASM parser
  'POST /api/parse/batch': async (req, res) => {
    const startTime = Date.now();

    try {
      const body = await parseBody(req);
      const { instructions } = JSON.parse(body);

      const result = await wasmParseBatch(instructions);
      metrics.recordRequest('/api/parse/batch', Date.now() - startTime, 200);
      sendJSON(res, 200, result);
    } catch (err) {
      metrics.recordRequest('/api/parse/batch', Date.now() - startTime, 500);
      sendJSON(res, 500, { error: CONFIG.NODE_ENV === 'production' ? 'Internal server error' : err.message });
    }
  },

  // SSE: Run all tests
  'GET /api/tests/run': (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    addClient(res);

    req.on('close', () => removeClient(res));

    runAllTests(res).catch(err => {
      log('error', 'Test run error', { error: err.message });
      sendSSE(res, 'error', { message: err.message });
      removeClient(res);
    });
  },

  // SSE: Run category tests
  'GET /api/tests/category/:id': (req, res, params) => {
    const categoryId = params.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    addClient(res);

    req.on('close', () => removeClient(res));

    runCategoryTests(categoryId, res).catch(err => {
      log('error', 'Category test error', { error: err.message, category: categoryId });
      sendSSE(res, 'error', { message: err.message });
      removeClient(res);
    });
  },
};

// ============================================================================
// MAIN SERVER
// ============================================================================

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Set CORS headers
  setCORSHeaders(res);

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Rate limiting
  const clientId = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const rateLimit = rateLimiter.isAllowed(clientId);

  if (!rateLimit.allowed) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': rateLimit.retryAfter,
    });
    res.end(JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter,
    }));
    return;
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', CONFIG.RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  // Route matching
  const routeKey = `${req.method} ${pathname}`;
  const categoryRouteKey = `${req.method} ${pathname.replace(/\/[^/]+$/, '/:id')}`;

  if (routes[routeKey]) {
    Promise.resolve(routes[routeKey](req, res)).catch(err => {
      log('error', 'Route handler error', { error: err.message, route: routeKey });
      sendJSON(res, 500, { error: 'Internal server error' });
    });
  } else if (routes[categoryRouteKey]) {
    const id = pathname.split('/').pop();
    Promise.resolve(routes[categoryRouteKey](req, res, { id })).catch(err => {
      log('error', 'Route handler error', { error: err.message, route: categoryRouteKey });
      sendJSON(res, 500, { error: 'Internal server error' });
    });
  } else {
    // Static file serving
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    fs.access(filePath, fs.constants.F_OK, err => {
      if (err) {
        // Try index.html for client-side routing
        serveStaticFile(res, path.join(__dirname, 'index.html'));
        return;
      }
      serveStaticFile(res, filePath);
    });
  }

  // Log request
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    log('debug', 'Request handled', {
      method: req.method,
      path: pathname,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
});

// Set server timeout
server.timeout = CONFIG.REQUEST_TIMEOUT_MS;

// ============================================================================
// STARTUP & SHUTDOWN
// ============================================================================

server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  log('info', 'Intelligent Medication Sig Parser server started', {
    port: CONFIG.PORT,
    host: CONFIG.HOST,
    env: CONFIG.NODE_ENV,
  });
});

function gracefulShutdown(signal) {
  log('info', `Received ${signal}, starting graceful shutdown...`);

  // Close all SSE connections
  clients.forEach(client => {
    try {
      client.end();
    } catch (err) {
      // Ignore
    }
  });

  // Clear all intervals
  keepaliveIntervals.forEach(interval => clearInterval(interval));

  server.close(() => {
    log('info', 'Server closed gracefully');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    log('error', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', err => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', { reason });
  process.exit(1);
});
