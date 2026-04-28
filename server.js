'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const rewriteRouter = require('../routes/rewrite');

// ── Sanity check: fail fast if the API key is missing ─────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    '\n[Mouthnote] FATAL: ANTHROPIC_API_KEY is not set.\n' +
      'Copy .env.example → .env and add your key.\n'
  );
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── Middleware ─────────────────────────────────────────────────────────

// CORS — only the listed origins may call this API
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" is not allowed`));
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// JSON body parser — cap at 64 KB to prevent abuse
app.use(express.json({ limit: '64kb' }));

// Rate limiter — defaults to 30 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  // Always return JSON, never HTML
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.',
      code: 'RATE_LIMITED',
    });
  },
});
app.use('/api', limiter);

// ── Routes ─────────────────────────────────────────────────────────────
app.use('/api', rewriteRouter);

// Health check — useful for uptime monitors / Docker healthchecks
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'mouthnote-backend' });
});

// 404 — catch any unknown routes and return JSON (never HTML)
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' });
});

// Global error handler — catches anything that slipped through
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Mouthnote] Unhandled error:', err?.message ?? err);
  res.status(500).json({
    error: 'An unexpected server error occurred.',
    code: 'INTERNAL_ERROR',
  });
});

// ── Start ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✓ Mouthnote backend running on http://localhost:${PORT}`);
  console.log(`  POST http://localhost:${PORT}/api/rewrite`);
  console.log(`  GET  http://localhost:${PORT}/health\n`);
});

module.exports = app; // exported for testing
