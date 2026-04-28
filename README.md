# Mouthnote Backend

Minimal Express backend that powers the **Rewrite** feature of the Mouthnote dental clinical writing assistant.

---

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Rate limiting | express-rate-limit |

---

## Project structure

```
mouthnote-backend/
├── src/
│   ├── server.js          ← Express app entry point
│   └── rewrite.js         ← AI call + system prompt logic
├── routes/
│   └── rewrite.js         ← POST /api/rewrite route handler
├── pages-api-rewrite.js   ← Drop-in Next.js API route alternative
├── frontend-integration.js← How to wire the frontend to this backend
├── .env.example           ← Environment variable template
└── package.json
```

---

## Quick start

### 1. Install

```bash
cd mouthnote-backend
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` and fill in your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
ALLOWED_ORIGINS=http://localhost:5500,http://localhost:3000
PORT=3001
```

Get your key at → https://console.anthropic.com/

### 3. Run

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

You should see:

```
✓ Mouthnote backend running on http://localhost:3001
  POST http://localhost:3001/api/rewrite
  GET  http://localhost:3001/health
```

---

## API reference

### `POST /api/rewrite`

**Request body** (JSON):

```json
{
  "note": "patient came in with pain. percussion positive. diagnosed irrev pulpitis. did rct on 46.",
  "language": "en",
  "style": "freestyle"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `note` | string | ✅ | 10–8000 chars |
| `language` | string | ❌ | `"en"` (default) · `"es"` · `"nl"` |
| `style` | string | ❌ | `"freestyle"` (default) · `"soap"` |

**Success response** `200`:

```json
{
  "rewritten_note": "Chief Complaint: Pain in mandibular right first molar (FDI 46).\n\nClinical Findings:\n- Percussion: Positive\n\nAssessment: Irreversible pulpitis — tooth 46.\n\nTreatment: Root canal treatment completed on tooth 46.\n\nPlan: Final restoration to be placed."
}
```

**Error response** (all errors return JSON, never HTML):

```json
{
  "error": "Note is too short (minimum 10 characters).",
  "code": "NOTE_TOO_SHORT"
}
```

| HTTP | code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | Missing or malformed `note` field |
| 400 | `NOTE_TOO_SHORT` | Note < 10 characters |
| 400 | `NOTE_TOO_LONG` | Note > 8000 characters |
| 400 | `INVALID_LANGUAGE` | Unsupported language code |
| 405 | `METHOD_NOT_ALLOWED` | Non-POST request |
| 429 | `RATE_LIMITED` | Too many requests (>30 / 15 min per IP) |
| 500 | `AUTH_ERROR` | Invalid Anthropic API key |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `AI_UNAVAILABLE` | Anthropic API is down |

### `GET /health`

```json
{ "status": "ok", "service": "mouthnote-backend" }
```

---

## Test with curl

```bash
# Basic rewrite (English)
curl -X POST http://localhost:3001/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{"note": "patient came in pain, tooth 46, percussion positive. irreversible pulpitis. did rct today."}'

# Spanish note
curl -X POST http://localhost:3001/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{"note": "paciente con dolor diente 46 percusion positiva pulpitis irreversible hice tce hoy", "language": "es"}'

# SOAP format
curl -X POST http://localhost:3001/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{"note": "patient came in pain. cold test prolonged. percussion positive. did rct on 46.", "style": "soap"}'

# Health check
curl http://localhost:3001/health
```

---

## Connect the frontend

See `frontend-integration.js` for full instructions.

**TL;DR for the standalone HTML file:**

1. Open `mouthnote.html`
2. Delete the existing `doRewrite()` and `mockRewrite()` functions
3. Paste the contents of `frontend-integration.js` into the `<script>` block
4. Make sure `BACKEND_URL` in that file points to your running backend

---

## Deploy

### Render (recommended — free tier available)

1. Push this folder to a GitHub repo
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set **Build command**: `npm install`
4. Set **Start command**: `npm start`
5. Add environment variables in the Render dashboard:
   - `ANTHROPIC_API_KEY` ← your key
   - `ALLOWED_ORIGINS` ← your frontend URL
   - `PORT` ← Render sets this automatically; you can omit it

### Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "src/server.js"]
```

```bash
docker build -t mouthnote-backend .
docker run -p 3001:3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e ALLOWED_ORIGINS=http://localhost:5500 \
  mouthnote-backend
```

---

## Using Next.js instead?

Copy `pages-api-rewrite.js` to `pages/api/rewrite.js` in your Next.js project.  
Install the SDK: `npm install @anthropic-ai/sdk`  
Add `ANTHROPIC_API_KEY` to `.env.local`.  
Done — the frontend `fetch('/api/rewrite', ...)` will hit it automatically (no CORS needed).
