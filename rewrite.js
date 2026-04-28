'use strict';

const express = require('express');
const { rewriteNote } = require('../src/rewrite');

const router = express.Router();

/**
 * POST /api/rewrite
 *
 * Body:
 *   { note: string, language?: 'en'|'es'|'nl', style?: 'freestyle'|'soap' }
 *
 * Response 200:
 *   { rewritten_note: string }
 *
 * Response 4xx / 5xx:
 *   { error: string, code?: string }
 */
router.post('/rewrite', async (req, res) => {
  const { note, language = 'en', style = 'freestyle' } = req.body ?? {};

  // ── Input validation ───────────────────────────────────────────────
  if (!note || typeof note !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid field: "note" must be a non-empty string.',
      code: 'INVALID_INPUT',
    });
  }

  if (note.trim().length < 10) {
    return res.status(400).json({
      error: 'Note is too short. Please write at least 10 characters.',
      code: 'NOTE_TOO_SHORT',
    });
  }

  if (note.trim().length > 8000) {
    return res.status(400).json({
      error: 'Note exceeds the maximum allowed length of 8000 characters.',
      code: 'NOTE_TOO_LONG',
    });
  }

  const validLanguages = ['en', 'es', 'nl'];
  if (language && !validLanguages.includes(language)) {
    return res.status(400).json({
      error: `Invalid language "${language}". Supported values: ${validLanguages.join(', ')}.`,
      code: 'INVALID_LANGUAGE',
    });
  }

  // ── Call AI ────────────────────────────────────────────────────────
  try {
    const rewritten = await rewriteNote(note, language, style);
    return res.status(200).json({ rewritten_note: rewritten });
  } catch (err) {
    console.error('[/api/rewrite] AI error:', err?.message ?? err);

    // Anthropic SDK surfaces API errors with a `status` property
    if (err?.status === 401) {
      return res.status(500).json({
        error: 'API authentication failed. Check your ANTHROPIC_API_KEY.',
        code: 'AUTH_ERROR',
      });
    }
    if (err?.status === 429) {
      return res.status(429).json({
        error: 'AI rate limit reached. Please try again in a moment.',
        code: 'RATE_LIMITED',
      });
    }
    if (err?.status >= 500) {
      return res.status(502).json({
        error: 'The AI service is temporarily unavailable. Please try again.',
        code: 'AI_UNAVAILABLE',
      });
    }

    // Validation errors thrown by rewrite.js
    if (err?.message?.includes('too short') || err?.message?.includes('maximum length')) {
      return res.status(400).json({ error: err.message, code: 'INVALID_INPUT' });
    }

    // Catch-all
    return res.status(500).json({
      error: 'An unexpected error occurred while rewriting the note.',
      code: 'INTERNAL_ERROR',
    });
  }
});

module.exports = router;
