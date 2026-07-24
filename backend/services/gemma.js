/**
 * backend/services/gemma.js
 *
 * Gemma 4 Orchestration Pipeline — Stage 3
 *
 * Implements a strict three-phase non-conversational image-to-schema pipeline:
 *   Phase 1 — Guardrails: System instructions + thinking config
 *   Phase 2 — Ingestion: Raw image buffer + structured context
 *   Phase 3 — Structured Enforcement: Deterministic JSON Schema output
 *
 * Returns a validated ParseResult object or a VisualParserError.
 */

import { GoogleGenAI } from '@google/genai';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_ID = 'gemma-4-27b-it'; // Gemma 4 multimodal vision model

/**
 * Deterministic JSON Schema enforced on every AI response.
 * Matches the frontend data contract exactly.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    meter_serial_number: {
      type: 'string',
      description: 'The unique serial number printed on the KPLC meter face or found in the M-Pesa receipt header.',
    },
    data_source_type: {
      type: 'string',
      enum: ['PHYSICAL_LCD', 'MPESA_SCREENSHOT'],
      description: 'Classification of the submitted image asset.',
    },
    remaining_units_kwh: {
      type: 'number',
      description: 'Remaining prepaid electricity balance in kilowatt-hours as displayed on the meter or receipt.',
    },
    load_kilowatts: {
      type: 'number',
      description: 'Current instantaneous power draw in kilowatts. Use 0.0 if not visible.',
    },
    token_strings: {
      type: 'array',
      items: { type: 'string' },
      description: 'All numeric token strings found in the image. Each KPLC token is exactly 20 digits. Firmware upgrades contain 3 tokens.',
    },
    active_error_code: {
      type: ['string', 'null'],
      description: 'Any KPLC error code visible on the meter display (e.g. "Err 30", "TAMP"). Null if none.',
    },
  },
  required: [
    'meter_serial_number',
    'data_source_type',
    'remaining_units_kwh',
    'load_kilowatts',
    'token_strings',
    'active_error_code',
  ],
};

/**
 * Phase 1 — System Guardrails
 * Forces the model into pure schema-compiler mode. No prose. No explanations.
 */
const SYSTEM_INSTRUCTION = `You are a deterministic unstructured-to-structured schema compiler specialising in Kenya Power (KPLC) prepaid electricity meter imagery and M-Pesa payment receipt screenshots.

Your ONLY output is a strictly conformant JSON object. You MUST NOT emit any prose, explanation, markdown, or conversational text—only raw JSON.

VISUAL EXTRACTION RULES:
1. LCD/Display glare: Apply contrast normalisation mentally. Read digits beneath overexposed zones by inferring partial character outlines.
2. Deep shadows: Use surrounding digit morphology and grid line patterns to infer obscured characters.
3. Dust/condensation: Treat partial character masks as complete if ≥50% of the digit stroke is visible.
4. Cracked screens: Extract whatever digits are visible. Mark any segment as null or error if fully unreadable.
5. M-Pesa screenshots: Extract the token string from the "Token:" field, the units from "Units:" or "Amount:", and the account number as meter_serial_number.
6. Error codes: If the display shows "Err", "TAMP", "BATT", or any numeric error code, capture it verbatim in active_error_code.
7. Token extraction: KPLC standard tokens are exactly 20 numeric digits. Firmware upgrade receipts contain 3 consecutive 20-digit tokens. Extract all of them into token_strings.
8. If remaining units cannot be read at all, use -1 to signal a visual parse failure.
9. ALWAYS return all required schema keys. Use null for strings, 0.0 for numbers, [] for arrays when the value cannot be extracted.`;

// ─── Parser Error Types ───────────────────────────────────────────────────────

export class VisualParserError extends Error {
  constructor(reason, rawResponse = null) {
    super(`Visual parsing failed: ${reason}`);
    this.name = 'VisualParserError';
    this.reason = reason;
    this.rawResponse = rawResponse;
    this.errorState = {
      meter_serial_number: 'UNKNOWN',
      data_source_type: 'PHYSICAL_LCD',
      remaining_units_kwh: -1,
      load_kilowatts: 0,
      token_strings: [],
      active_error_code: 'PARSE_FAILED',
      _parser_error: reason,
    };
  }
}

// ─── Gemma Client Initialisation ─────────────────────────────────────────────

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Runs the three-phase Gemma 4 vision pipeline.
 *
 * @param {Buffer}  imageBuffer  — Raw image bytes from multipart upload
 * @param {string}  mimeType     — Image MIME type (e.g. 'image/jpeg')
 * @param {object}  context      — Server-attached tracking context
 * @returns {object}             — Validated ParseResult matching RESPONSE_SCHEMA
 * @throws  {VisualParserError}  — On blank/cracked/unreadable images
 */
export async function runGemmaPipeline(imageBuffer, mimeType, context) {
  const client = getClient();

  // ── Phase 2: Build multimodal prompt with image + context ──────────────────

  const contextPrompt = buildContextPrompt(context);

  const imagePart = {
    inlineData: {
      mimeType,
      data: imageBuffer.toString('base64'),
    },
  };

  const textPart = {
    text: contextPrompt,
  };

  // ── Phase 1 + 3: Apply system instructions + enforce JSON schema output ────

  let rawText;
  try {
    const response = await client.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [imagePart, textPart],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // Phase 1 Guardrails — Maximum reasoning for complex visual scenarios
        thinkingConfig: {
          thinkingBudget: 8192, // High thinking budget for difficult LCD/glare scenarios
        },
        // Phase 3 Structured Enforcement — deterministic JSON schema output
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1, // Near-deterministic for data extraction
        topP: 0.9,
        maxOutputTokens: 512,
      },
    });

    rawText = response.text();
  } catch (apiError) {
    // Network / API failure — not a visual failure
    throw new VisualParserError(`API error: ${apiError.message}`, null);
  }

  // ── Parse and validate structured response ────────────────────────────────

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (jsonError) {
    throw new VisualParserError(`JSON parse error — model returned non-JSON output`, rawText);
  }

  // Detect blank/cracked screen via sentinel value
  if (parsed.remaining_units_kwh === -1) {
    const errorMsg = parsed.active_error_code
      ? `Meter display error: ${parsed.active_error_code}`
      : 'Meter display is blank or unreadable (cracked screen / power outage)';
    throw new VisualParserError(errorMsg, parsed);
  }

  // Sanitise and clamp numeric fields against physical impossibilities
  parsed.remaining_units_kwh = clamp(parseFloat(parsed.remaining_units_kwh ?? 0), 0, 999.9);
  parsed.load_kilowatts = clamp(parseFloat(parsed.load_kilowatts ?? 0), 0, 15);
  parsed.token_strings = Array.isArray(parsed.token_strings) ? parsed.token_strings : [];

  return parsed;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds the text portion of the multimodal prompt carrying server-side context.
 */
function buildContextPrompt(context) {
  return `ANALYSIS REQUEST
────────────────
Capture Timestamp : ${context.captured_at}
Session ID        : ${context.session_id}
Grid Region       : Nairobi, Kenya (KPLC 50Hz/240V single-phase residential)
Meter ID (hint)   : ${context.meter_id_hint ?? 'Unknown — extract from image'}

Extract all readable meter data from the attached image following the schema rules.
Return ONLY the JSON object. No other output.`;
}

/**
 * Clamp a number within [min, max] inclusive.
 */
function clamp(val, min, max) {
  if (isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}
