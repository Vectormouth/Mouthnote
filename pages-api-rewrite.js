/**
 * Next.js API Route — pages/api/rewrite.js
 * (also works as app/api/rewrite/route.js with minor adaptation — see bottom)
 *
 * POST /api/rewrite
 * Body:  { note: string, language?: 'en'|'es'|'nl', style?: 'freestyle'|'soap' }
 * Returns: { rewritten_note: string } | { error: string, code: string }
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // set in .env.local
});

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

// ── System prompts per language ────────────────────────────────────────
const SYSTEM_PROMPTS = {
  en: `You are a professional dental clinical documentation specialist.
Your task is to rewrite dental clinical notes to be clear, concise, and professionally structured.

RULES:
- Preserve ALL clinical facts, measurements, findings, and treatment details exactly
- Use standard dental/medical terminology appropriate for professional records
- Organise the note with proper headings: Chief Complaint, Medical History (if present), Clinical Findings, Assessment, Treatment, Plan
- Remove filler words and repetition; keep it tight and factual
- Do not add information that was not in the original note
- Do not remove clinical information from the original note
- Write in third-person professional style (e.g. "Patient reports…", "Examination reveals…")
- Return ONLY the rewritten note — no preamble, no explanation, no markdown fences`,

  es: `Eres un especialista profesional en documentación clínica dental.
Tu tarea es reescribir notas clínicas dentales para que sean claras, concisas y con estructura profesional.

REGLAS:
- Conserva TODOS los datos clínicos, medidas, hallazgos y detalles del tratamiento exactamente
- Utiliza terminología dental/médica estándar adecuada para registros profesionales
- Organiza la nota con encabezados apropiados: Motivo de consulta, Antecedentes médicos (si los hay), Hallazgos clínicos, Juicio clínico, Tratamiento, Plan
- Elimina muletillas y repeticiones; mantén el texto conciso y factual
- No añadas información que no estuviera en la nota original
- No elimines información clínica de la nota original
- Escribe en estilo profesional en tercera persona (p.ej. "El paciente refiere…", "La exploración revela…")
- Devuelve ÚNICAMENTE la nota reescrita — sin preámbulo, sin explicación, sin comillas de código`,

  nl: `Je bent een professionele specialist in klinische tandheelkundige documentatie.
Jouw taak is het herschrijven van klinische tandheelkundige notities zodat ze helder, beknopt en professioneel gestructureerd zijn.

REGELS:
- Bewaar ALLE klinische feiten, metingen, bevindingen en behandeldetails exact
- Gebruik standaard tandheelkundige/medische terminologie die geschikt is voor professionele dossiers
- Structureer de notitie met de juiste koppen: Klacht, Medische anamnese (indien aanwezig), Klinische bevindingen, Beoordeling, Behandeling, Beleid
- Verwijder stopwoorden en herhalingen; houd het beknopt en feitelijk
- Voeg geen informatie toe die niet in de originele notitie stond
- Verwijder geen klinische informatie uit de originele notitie
- Schrijf in professionele derde-persoon stijl (bijv. "Patiënt meldt…", "Onderzoek toont…")
- Geef ALLEEN de herschreven notitie terug — geen inleiding, geen uitleg, geen code-aanhalingstekens`,
};

// ── Handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.', code: 'METHOD_NOT_ALLOWED' });
  }

  const { note, language = 'en', style = 'freestyle' } = req.body ?? {};

  // ── Validation ─────────────────────────────────────────────────────
  if (!note || typeof note !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid field: "note".', code: 'INVALID_INPUT' });
  }
  const trimmed = note.trim();
  if (trimmed.length < 10) {
    return res.status(400).json({ error: 'Note is too short (minimum 10 characters).', code: 'NOTE_TOO_SHORT' });
  }
  if (trimmed.length > 8000) {
    return res.status(400).json({ error: 'Note exceeds maximum length of 8000 characters.', code: 'NOTE_TOO_LONG' });
  }

  const validLangs = ['en', 'es', 'nl'];
  const lang = validLangs.includes(language) ? language : 'en';
  const systemPrompt = SYSTEM_PROMPTS[lang];

  const soapSuffix =
    style === 'soap'
      ? '\n\nIMPORTANT: Structure the rewritten note strictly in SOAP format: Subjective, Objective, Assessment, Plan.'
      : '';

  // ── AI call ────────────────────────────────────────────────────────
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Please rewrite the following dental clinical note:\n\n${trimmed}${soapSuffix}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock?.text) {
      return res.status(500).json({ error: 'AI returned an empty response.', code: 'EMPTY_RESPONSE' });
    }

    return res.status(200).json({ rewritten_note: textBlock.text.trim() });
  } catch (err) {
    console.error('[/api/rewrite]', err?.message ?? err);

    if (err?.status === 401) return res.status(500).json({ error: 'API key is invalid or missing.', code: 'AUTH_ERROR' });
    if (err?.status === 429) return res.status(429).json({ error: 'AI rate limit reached. Try again shortly.', code: 'RATE_LIMITED' });
    if (err?.status >= 500) return res.status(502).json({ error: 'AI service temporarily unavailable.', code: 'AI_UNAVAILABLE' });

    return res.status(500).json({ error: 'Unexpected error while rewriting note.', code: 'INTERNAL_ERROR' });
  }
}

/*
 * ──────────────────────────────────────────────────────────────────────
 * App Router version (Next.js 13+)
 * Save as: app/api/rewrite/route.js
 * ──────────────────────────────────────────────────────────────────────
 *
 * import { NextResponse } from 'next/server';
 * import Anthropic from '@anthropic-ai/sdk';
 *
 * const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * export async function POST(request) {
 *   const body = await request.json();
 *   const { note, language = 'en', style = 'freestyle' } = body;
 *
 *   // ... same validation and AI call as above ...
 *
 *   return NextResponse.json({ rewritten_note: result });
 * }
 */
