/**
 * frontend-integration.js
 * ─────────────────────────────────────────────────────────────────────
 * Drop this logic into your Mouthnote HTML to replace the mock rewrite
 * with a real call to the backend.
 *
 * 1. Set BACKEND_URL to wherever your Express server is running.
 * 2. Replace the mockRewrite() call inside doRewrite() with callRewriteAPI().
 *
 * Everything else in the frontend stays exactly as-is.
 */

// ── Config ─────────────────────────────────────────────────────────────
// In production, replace with your deployed backend URL, e.g.:
// const BACKEND_URL = 'https://api.mouthnote.io';
const BACKEND_URL = 'http://localhost:3001';

// ── API call ───────────────────────────────────────────────────────────
/**
 * Sends the note to the backend and returns the rewritten text.
 * Throws a user-friendly Error on failure.
 *
 * @param {string} note
 * @param {string} language  'en' | 'es' | 'nl'
 * @param {string} style     'freestyle' | 'soap'
 * @returns {Promise<string>}
 */
async function callRewriteAPI(note, language, style) {
  const response = await fetch(`${BACKEND_URL}/api/rewrite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, language, style }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Surface the server's own error message to the user
    throw new Error(data?.error ?? `Server error ${response.status}`);
  }

  if (!data?.rewritten_note) {
    throw new Error('Server returned an empty rewrite.');
  }

  return data.rewritten_note;
}

// ── Replacement for doRewrite() in Mouthnote HTML ─────────────────────
// Swap out the existing doRewrite() function with this version.
// It calls the real API instead of mockRewrite().

async function doRewrite() {
  const note = document.getElementById('noteArea').value.trim();
  if (!note || note.length < 10) return;

  const btn = document.getElementById('rewriteBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span><span>Rewriting…</span>';

  try {
    // `lang` and `style` are the existing global variables from Mouthnote
    const rewritten = await callRewriteAPI(note, lang, style);

    document.getElementById('rwContent').textContent = rewritten;
    // Store for accept/copy actions
    window.lastRewritten = rewritten;
    document.getElementById('rwModal').classList.add('open');
  } catch (err) {
    showToast('Rewrite failed: ' + err.message);
    console.error('[Mouthnote] doRewrite error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>↑</span><span>Rewrite</span>';
  }
}

/*
 * ─────────────────────────────────────────────────────────────────────
 * HOW TO INTEGRATE
 * ─────────────────────────────────────────────────────────────────────
 *
 * Option A — Script tag (quickest, for the standalone HTML file):
 *
 *   1. Open mouthnote.html
 *   2. Find the existing doRewrite() function and DELETE it
 *   3. Paste the contents of this file just above the closing </script> tag
 *
 * Option B — Separate file:
 *
 *   1. Save this file as frontend-integration.js
 *   2. In mouthnote.html, add BEFORE </body>:
 *        <script src="frontend-integration.js"></script>
 *   3. Remove the old doRewrite() and mockRewrite() from the HTML's <script>
 *
 * ─────────────────────────────────────────────────────────────────────
 * ENVIRONMENT NOTES
 * ─────────────────────────────────────────────────────────────────────
 *
 * Local development:
 *   Backend: http://localhost:3001
 *   Frontend served with VS Code Live Server or similar on port 5500
 *   → Set ALLOWED_ORIGINS=http://localhost:5500 in backend .env
 *
 * Production (example — Render + Vercel):
 *   Backend deployed to Render → https://mouthnote-api.onrender.com
 *   Frontend deployed to Vercel → https://mouthnote.vercel.app
 *   → Set ALLOWED_ORIGINS=https://mouthnote.vercel.app in Render env vars
 *   → Set BACKEND_URL='https://mouthnote-api.onrender.com' in this file
 */
