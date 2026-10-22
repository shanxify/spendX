const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

// ── Models & Deprecation Safeguards ───────────────────────────────────
// Known shut-down, deprecated, or preview-disabled Gemini models that must never be used
const DEPRECATED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-thinking-exp',
  'gemini-2.0-pro-exp',
  'gemini-1.0-pro',
  'gemini-pro',
]);

// Candidate models in priority order:
// Supports active Google Gemini models with intelligent fallback
const SUPPORTED_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
];

function getCandidateModels() {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  if (envModel) {
    if (DEPRECATED_MODELS.has(envModel.toLowerCase())) {
      console.warn('[Gemini Model Config]', {
        warning: 'DEPRECATED_MODEL_OVERRIDE_IGNORED',
        model: envModel,
      });
      return [...SUPPORTED_MODELS];
    }
    // Put user-specified supported model first, followed by fallbacks without duplicates
    return [envModel, ...SUPPORTED_MODELS.filter(m => m !== envModel)];
  }
  return [...SUPPORTED_MODELS];
}

// ── Safe Diagnostics Logger ──────────────────────────────────────────
// Logs ONLY status code, safe category, model, and request ID.
// Never logs API keys, Authorization headers, or user message content.
function categorizeError(err) {
  if (!err) return { status: 500, category: 'UNKNOWN_ERROR' };

  const status = Number(err.status) || (typeof err.message === 'string' && err.message.includes('404') ? 404 : 0);
  const msg = (err.message || '').toLowerCase();

  if (err.name === 'AbortError' || msg.includes('timeout') || msg.includes('aborted')) {
    return { status: 504, category: 'TIMEOUT' };
  }
  if (status === 404 || msg.includes('not found') || msg.includes('unsupported') || msg.includes('is not available')) {
    return { status: 404, category: 'MODEL_UNSUPPORTED_OR_NOT_FOUND' };
  }
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
    return { status: 429, category: 'QUOTA_OR_RATE_LIMIT_EXCEEDED' };
  }
  if (status === 401 || status === 403 || msg.includes('api_key_invalid') || msg.includes('api key')) {
    return { status: 503, category: 'API_KEY_INVALID_OR_FORBIDDEN' };
  }
  return { status: status || 500, category: 'PROVIDER_ERROR' };
}

function extractSafeRequestId(err) {
  if (err && typeof err === 'object') {
    if (err.requestId) return String(err.requestId);
    if (err.response && err.response.headers) {
      const h = err.response.headers;
      const reqId = typeof h.get === 'function' ? h.get('x-request-id') : h['x-request-id'];
      if (reqId) return String(reqId);
    }
  }
  return undefined;
}

function logSafeDiagnostic(err, attemptedModel) {
  const { status, category } = categorizeError(err);
  const requestId = extractSafeRequestId(err);
  console.error('[Gemini Diagnostic]', {
    providerStatus: status,
    category,
    attemptedModel,
    ...(requestId ? { requestId } : {}),
  });
}

// ── Auth (Validates bearer token via Supabase Auth) ───────────────────
async function getAuthenticatedClient(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { supabase: null, user: null };

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { supabase: null, user: null };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('[Auth Diagnostic]', { category: 'SUPABASE_ENV_MISSING' });
    return { supabase: null, user: null };
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data || !data.user) {
      return { supabase: null, user: null };
    }
    return { supabase, user: data.user };
  } catch (err) {
    console.error('[Auth Diagnostic]', { category: 'AUTH_VERIFICATION_EXCEPTION' });
    return { supabase: null, user: null };
  }
}

// ── In-memory per-user rate limiter ──────────────────────────────────
// NOTE: Resets on cold starts; does not share state across Vercel instances.
// For production-grade enforcement, upgrade to Upstash Redis rate limiting.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10;              // 10 requests per window
const rateLimitMap = new Map();

function checkRateLimit(userId) {
  const now = Date.now();
  let entry = rateLimitMap.get(userId);

  // Clean expired entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 1 };
    rateLimitMap.set(userId, entry);
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ── Input validation ─────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 10;
const ALLOWED_ROLES = new Set(['user', 'model']);

function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  const { message, history } = body;

  if (message === undefined || message === null) {
    return 'Message is required';
  }
  if (typeof message !== 'string') {
    return 'Message must be a string';
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return 'Message cannot be empty';
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer`;
  }

  if (history !== undefined) {
    if (!Array.isArray(history)) {
      return 'History must be an array';
    }
    if (history.length > MAX_HISTORY_LENGTH) {
      return `History must contain ${MAX_HISTORY_LENGTH} messages or fewer`;
    }
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item || typeof item !== 'object') {
        return `History item ${i} is invalid`;
      }
      if (!ALLOWED_ROLES.has(item.role)) {
        return `History item ${i} has invalid role "${item.role}"`;
      }
      if (typeof item.text !== 'string' || item.text.length === 0) {
        return `History item ${i} must have non-empty text`;
      }
      if (item.text.length > MAX_MESSAGE_LENGTH) {
        return `History item ${i} text exceeds ${MAX_MESSAGE_LENGTH} characters`;
      }
    }
  }

  return null; // valid
}

// ── System instruction ───────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are the SpendX AI Assistant — a helpful, friendly personal finance companion built into SpendX, a UPI expense analytics platform.

Your capabilities in this version:
• Explain how SpendX works: uploading PhonePe, Google Pay (GPay), and Paytm PDF transaction statements, the dashboard, transaction lists, category management, merchant mapping, and analytics.
• Help users troubleshoot PDF upload issues (file format, supported providers, size limits).
• Answer general personal finance questions: budgeting strategies, saving tips, expense tracking best practices, and financial literacy concepts.
• Provide clear, practical, and concise advice.
• Ask clarifying questions when the user's request is ambiguous.

Important rules:
• You do NOT have access to the user's personal transaction data, spending history, balances, or financial records in this version. If asked about personal spending (e.g., "How much did I spend this month?"), politely explain that personal transaction analysis is coming in a future update, and suggest they check their SpendX dashboard directly.
• Never invent, fabricate, or guess financial amounts, transactions, balances, or spending patterns.
• Never guarantee specific investment returns or provide licensed financial advice.
• Never request passwords, OTPs, UPI PINs, bank account numbers, or full card numbers.
• Be honest about your limitations. If you don't know something, say so.
• Keep responses focused and readable — use bullet points or short paragraphs.
• Stay on topic: SpendX features, personal finance, and budgeting. For unrelated topics, politely redirect.

Tone: Professional yet approachable. Think of yourself as a knowledgeable friend who happens to be great with money.`;

// ── Main handler ─────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are accepted' }
    });
  }

  // ── Authentication ───────────────────────────────────────────────
  const { user } = await getAuthenticatedClient(req);
  if (!user) {
    return res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Please log in to use the AI assistant' }
    });
  }

  // ── Rate limiting ────────────────────────────────────────────────
  try {
    const { allowed } = checkRateLimit(user.id);
    if (!allowed) {
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment before trying again.' }
      });
    }
  } catch (rateLimitError) {
    // Fail closed — deny on rate limiter error
    console.error('[Rate Limiter Diagnostic]', { category: 'RATE_LIMITER_EXCEPTION' });
    return res.status(503).json({
      error: { code: 'SERVICE_ERROR', message: 'Service temporarily unavailable. Please try again.' }
    });
  }

  // ── Content-Type check ──────────────────────────────────────────
  const contentType = req.headers['content-type'] || '';
  if (contentType && !contentType.includes('application/json')) {
    return res.status(400).json({
      error: { code: 'INVALID_CONTENT_TYPE', message: 'Content-Type must be application/json' }
    });
  }

  // ── Parse body if received as raw string ─────────────────────────
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (parseError) {
      return res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Malformed JSON in request body' }
      });
    }
  }

  // ── Input validation ─────────────────────────────────────────────
  const validationError = validateRequest(body);
  if (validationError) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: validationError }
    });
  }

  // ── Gemini configuration check ───────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini Diagnostic]', { category: 'GEMINI_API_KEY_MISSING' });
    return res.status(503).json({
      error: { code: 'CONFIG_ERROR', message: 'AI assistant is not configured. Please contact support.' }
    });
  }

  // ── Build conversation contents ──────────────────────────────────
  const { message, history = [] } = body;
  const trimmedMessage = message.trim();

  const contents = [];

  // Add validated history
  for (const item of history) {
    contents.push({
      role: item.role,
      parts: [{ text: item.text }]
    });
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: trimmedMessage }]
  });

  // ── Execute Gemini with Resilient Model Fallback ──────────────────
  const candidateModels = getCandidateModels();
  let reply = null;
  let lastError = null;

  // Global deadline for the entire request (25 seconds)
  const deadline = Date.now() + 25000;

  try {
    const ai = new GoogleGenAI({ apiKey });

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      const remainingTime = deadline - Date.now();
      if (remainingTime < 3000) {
        break; // Stop if less than 3s remains to prevent hitting Vercel hard limit
      }

      // Per-attempt timeout: 8 seconds or remaining budget, whichever is smaller
      const attemptTimeoutMs = Math.min(8000, remainingTime);
      const attemptController = new AbortController();
      const attemptTimer = setTimeout(() => attemptController.abort(), attemptTimeoutMs);

      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            maxOutputTokens: 1024,
            temperature: 0.7,
            abortSignal: attemptController.signal,
          },
        });

        clearTimeout(attemptTimer);

        if (response && response.text && response.text.trim().length > 0) {
          reply = response.text.trim();
          break; // successfully generated
        }
      } catch (err) {
        clearTimeout(attemptTimer);
        lastError = err;
        logSafeDiagnostic(err, currentModel);

        const { category } = categorizeError(err);
        // Only stop if the API key is completely invalid across all models
        if (category === 'API_KEY_INVALID_OR_FORBIDDEN') {
          break;
        }

        // For all other errors (high demand 503, timeout, not found 404), seamlessly attempt the next fallback model
        continue;
      }
    }
  } catch (outerErr) {
    lastError = outerErr;
  }

  if (reply) {
    return res.status(200).json({ reply });
  }

  // Map to safe client error code and message
  const { category } = categorizeError(lastError);

  if (category === 'TIMEOUT') {
    return res.status(504).json({
      error: { code: 'AI_TIMEOUT', message: 'The assistant took too long to respond. Please try again.' }
    });
  }

  if (category === 'QUOTA_OR_RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: { code: 'AI_QUOTA_EXCEEDED', message: 'AI service is temporarily busy. Please try again in a few moments.' }
    });
  }

  if (category === 'API_KEY_INVALID_OR_FORBIDDEN') {
    return res.status(503).json({
      error: { code: 'CONFIG_ERROR', message: 'AI assistant is not configured correctly. Please contact support.' }
    });
  }

  if (category === 'MODEL_UNSUPPORTED_OR_NOT_FOUND') {
    return res.status(503).json({
      error: { code: 'MODEL_UNAVAILABLE', message: 'The AI model is currently unavailable. Please try again later.' }
    });
  }

  return res.status(500).json({
    error: { code: 'AI_ERROR', message: 'Unable to generate a response. Please try again later.' }
  });
};
