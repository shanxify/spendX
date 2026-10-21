const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

// ── Auth (same pattern as all other SpendX API endpoints) ────────────
async function getAuthenticatedClient(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { supabase: null, user: null };
  const token = authHeader.replace('Bearer ', '');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Supabase server environment variables are missing');
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
    const { data, error } = await supabase.auth.getUser();
    if (error || !data || !data.user) return { supabase: null, user: null };
    return { supabase, user: data.user };
  } catch (err) {
    console.error('Auth verification error:', err.message);
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
  // CORS headers (same as all other SpendX endpoints)
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
    console.error('Rate limiter error:', rateLimitError.message);
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
    console.error('GEMINI_API_KEY is not configured');
    return res.status(503).json({
      error: { code: 'CONFIG_ERROR', message: 'AI assistant is not configured. Please contact support.' }
    });
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

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

  // ── Call Gemini ──────────────────────────────────────────────────
  try {
    const ai = new GoogleGenAI({ apiKey });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      systemInstruction: SYSTEM_INSTRUCTION,
      config: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const reply = response.text;

    if (!reply || reply.trim().length === 0) {
      return res.status(502).json({
        error: { code: 'AI_EMPTY_RESPONSE', message: 'The assistant could not generate a response. Please try again.' }
      });
    }

    return res.status(200).json({ reply: reply.trim() });

  } catch (err) {
    // Don't log the full error object (may contain API key in stack traces)
    const errMessage = err.message || 'Unknown error';
    console.error('Gemini API error:', errMessage);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: { code: 'AI_TIMEOUT', message: 'The assistant took too long to respond. Please try again.' }
      });
    }

    // Handle quota / rate limit errors from Gemini
    if (errMessage.includes('429') || errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('rate limit')) {
      return res.status(429).json({
        error: { code: 'AI_QUOTA_EXCEEDED', message: 'AI service is temporarily busy. Please try again in a few moments.' }
      });
    }

    // Handle invalid API key
    if (errMessage.includes('401') || errMessage.includes('403') || errMessage.toLowerCase().includes('api key')) {
      return res.status(503).json({
        error: { code: 'CONFIG_ERROR', message: 'AI assistant is not configured correctly. Please contact support.' }
      });
    }

    return res.status(500).json({
      error: { code: 'AI_ERROR', message: 'Unable to generate a response. Please try again later.' }
    });
  }
};
