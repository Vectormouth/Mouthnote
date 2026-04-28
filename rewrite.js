'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// Initialise client once — the SDK reads ANTHROPIC_API_KEY from the environment
const client = new Anthropic();

// ── Model ──────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

// ── System prompt (language-aware) ────────────────────────────────────
/**
 * Builds the system prompt in the correct language so the AI's framing
 * instructions match the language of the note it is rewriting.
 *
 * @param {'en'|'es'|'nl'} lang
 * @returns {string}
 */
function buildSystemPrompt(lang) {
  const instructions = {
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

  // Fall back to English for any unsupported language code
  return instructions[lang] ?? instructions.en;
}

// ── Main rewrite function ──────────────────────────────────────────────
/**
 * Sends a clinical note to Claude and returns the professionally rewritten version.
 *
 * @param {string} note     — raw note text from the frontend
 * @param {string} lang     — 'en' | 'es' | 'nl' (defaults to 'en')
 * @param {string} [style]  — 'freestyle' | 'soap' (defaults to 'freestyle')
 * @returns {Promise<string>} rewritten note text
 */
async function rewriteNote(note, lang = 'en', style = 'freestyle') {
  // Validate inputs defensively before hitting the API
  if (!note || typeof note !== 'string') {
    throw new Error('note must be a non-empty string');
  }
  const trimmed = note.trim();
  if (trimmed.length < 10) {
    throw new Error('note is too short to rewrite (minimum 10 characters)');
  }
  if (trimmed.length > 8000) {
    throw new Error('note exceeds maximum length of 8000 characters');
  }

  const normalizedLang = ['en', 'es', 'nl'].includes(lang) ? lang : 'en';

  // Build the user prompt — add SOAP instruction if requested
  const soapSuffix =
    style === 'soap'
      ? '\n\nIMPORTANT: Structure the rewritten note strictly in SOAP format with four clearly labelled sections: Subjective, Objective, Assessment, Plan.'
      : '';

  const userMessage = `Please rewrite the following dental clinical note:\n\n${trimmed}${soapSuffix}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(normalizedLang),
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract the text content from the response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('AI returned an empty response');
  }

  return textBlock.text.trim();
}

module.exports = { rewriteNote };
