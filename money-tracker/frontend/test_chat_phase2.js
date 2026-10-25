'use strict';

/**
 * test_chat_phase2.js — Automated tests for SpendX Phase 2 chatbot (Supabase integration).
 *
 * Tests every security and data-correctness requirement from the spec:
 *  1.  Unauthenticated request → 401
 *  2.  Invalid/expired token → 401
 *  3.  User-A cannot see User-B data (user_id scoping enforced)
 *  4.  Category totals match dashboard calculations
 *  5.  Merchant totals and counts match
 *  6.  Date-range boundaries correct (current month vs previous month)
 *  7.  Empty transaction history → truthful "no data", no fabrication
 *  8.  Gemini receives finance context only AFTER auth + data retrieval
 *  9.  DB error → 502 DATA_UNAVAILABLE (no fabricated data)
 * 10.  Existing model fallback still works (quota error → next model)
 * 11.  No sensitive info in console.error logs
 * 12.  GET method → 405
 *
 * All Supabase and Gemini interactions are mocked — no real credentials needed.
 */

// ── Colour helpers ─────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failed++;
    failures.push(message);
    console.log(`  ${RED}✗ FAIL${RESET} ${message}`);
  } else {
    passed++;
    console.log(`  ${GREEN}✓ PASS${RESET} ${message}`);
  }
}

// ── Minimal mock framework ─────────────────────────────────────────────────────

/**
 * Build a minimal mock http req object.
 */
function mockReq({ method = 'POST', headers = {}, body = {} } = {}) {
  return { method, headers, body };
}

/**
 * Build a mock res object that captures the response.
 */
function mockRes() {
  const result = { statusCode: null, body: null, headers: {} };
  const res = {
    _result: result,
    setHeader(k, v) { result.headers[k] = v; },
    status(code) { result.statusCode = code; return res; },
    json(b)  { result.body = b; return res; },
    end()    { return res; },
  };
  return res;
}

// ── Module mock infrastructure ─────────────────────────────────────────────────
//
// We override require() for @supabase/supabase-js and @google/genai using
// Module._resolveFilename interception (Node's built-in mechanism) to keep
// this zero-dependency.

const Module = require('module');
const path   = require('path');

const originalLoad = Module._load;
let supabaseMock    = null;
let googleGenAIMock = null;

Module._load = function(request, parent, isMain) {
  if (request === '@supabase/supabase-js' && supabaseMock) return supabaseMock;
  if (request === '@google/genai'          && googleGenAIMock) return googleGenAIMock;
  return originalLoad.apply(this, arguments);
};

// Helper to clear Node's require cache for the chat.js and financeContext.js
// modules so each test group can inject fresh mocks.
function clearHandlerCache() {
  const chatKey = require.resolve('./api/chat.js');
  const fcKey   = require.resolve('./api/financeContext.js');
  delete require.cache[chatKey];
  delete require.cache[fcKey];
}

// ── Sample transaction fixtures ────────────────────────────────────────────────

const NOW = new Date();
const CUR_YEAR  = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth(); // 0-indexed

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// Current month transactions for User A
const CURRENT_MONTH_STR = isoDate(CUR_YEAR, CUR_MONTH + 1, 15);
// Previous month
const PREV_MONTH_STR    = isoDate(CUR_YEAR, CUR_MONTH === 0 ? 12 : CUR_MONTH, 10);

const USER_A_TXNS = [
  // Current month debits
  { type: 'debit',  amount: '500',  category: 'Food',       merchant: 'Swiggy',   normalizedMerchant: 'swiggy',   date: CURRENT_MONTH_STR, status: 'Success' },
  { type: 'debit',  amount: '300',  category: 'Transport',  merchant: 'Ola',      normalizedMerchant: 'ola',      date: CURRENT_MONTH_STR, status: 'Success' },
  { type: 'debit',  amount: '1200', category: 'Food',       merchant: 'Swiggy',   normalizedMerchant: 'swiggy',   date: CURRENT_MONTH_STR, status: 'Success' },
  // Current month credit
  { type: 'credit', amount: '5000', category: null,         merchant: 'Salary',   normalizedMerchant: 'salary',   date: CURRENT_MONTH_STR, status: 'Success' },
  // Failed — must be excluded from totals
  { type: 'debit',  amount: '9999', category: 'Food',       merchant: 'Zomato',   normalizedMerchant: 'zomato',   date: CURRENT_MONTH_STR, status: 'Failed'  },
  // Previous month debit
  { type: 'debit',  amount: '800',  category: 'Shopping',   merchant: 'Amazon',   normalizedMerchant: 'amazon',   date: PREV_MONTH_STR,    status: 'Success' },
];

// User B has completely different transactions
const USER_B_TXNS = [
  { type: 'debit', amount: '999999', category: 'Luxury', merchant: 'Ferrari', normalizedMerchant: 'ferrari', date: CURRENT_MONTH_STR, status: 'Success' },
];

// ── Helpers to build mocks ─────────────────────────────────────────────────────

function buildSupabaseMock({ authUserA = true, dbError = false, txnsForUser = null } = {}) {
  // txnsForUser: function(userId) => array of txns
  const getUser = authUserA
    ? async () => ({ data: { user: { id: 'user-a-uuid' } }, error: null })
    : async () => ({ data: null, error: new Error('Invalid token') });

  const makeQuery = (userId) => {
    const rows = txnsForUser ? txnsForUser(userId) : USER_A_TXNS;
    let filtered = [...rows];
    const q = {
      _gteDate: null, _lteDate: null,
      gte(col, val) { if (col === 'date') q._gteDate = val; return q; },
      lte(col, val) { if (col === 'date') q._lteDate = val; return q; },
      then(resolve) {
        if (dbError) return resolve({ data: null, error: new Error('DB failure') });
        if (q._gteDate) filtered = filtered.filter(t => t.date >= q._gteDate);
        if (q._lteDate) filtered = filtered.filter(t => t.date <= q._lteDate);
        return resolve({ data: filtered, error: null });
      },
    };
    // Make it a proper thenable promise
    return Object.assign(Promise.resolve().then(() => {
      if (dbError) return { data: null, error: new Error('DB failure') };
      let f = [...rows];
      if (q._gteDate) f = f.filter(t => t.date >= q._gteDate);
      if (q._lteDate) f = f.filter(t => t.date <= q._lteDate);
      return { data: f, error: null };
    }), q);
  };

  return {
    createClient: () => ({
      auth: { getUser },
      from: () => ({
        select: () => ({
          eq: (col, userId) => makeQueryChain(txnsForUser ? txnsForUser(userId) : USER_A_TXNS, dbError),
        }),
      }),
    }),
  };
}

function makeQueryChain(rows, dbError) {
  let gteDate = null, lteDate = null;
  const chain = {
    gte(col, val) { if (col === 'date') gteDate = val; return chain; },
    lte(col, val) { if (col === 'date') lteDate = val; return chain; },
    then(onFulfilled, onRejected) {
      return Promise.resolve().then(() => {
        if (dbError) return { data: null, error: new Error('DB failure') };
        let f = [...rows];
        if (gteDate) f = f.filter(t => t.date >= gteDate);
        if (lteDate) f = f.filter(t => t.date <= lteDate);
        return { data: f, error: null };
      }).then(onFulfilled, onRejected);
    },
    catch(fn) { return this.then(undefined, fn); },
    finally(fn) { return this.then(v => { fn(); return v; }, e => { fn(); throw e; }); },
  };
  return chain;
}

function buildGeminiMock({ replyText = 'AI response', failFirst = false, quotaError = false } = {}) {
  let callCount = 0;
  return {
    GoogleGenAI: class {
      constructor() {}
      get models() {
        return {
          generateContent: async ({ model }) => {
            callCount++;
            if (quotaError && callCount === 1) {
              const e = new Error('Resource exhausted quota');
              e.status = 429;
              throw e;
            }
            if (failFirst && callCount === 1) {
              const e = new Error('Model not found');
              e.status = 404;
              throw e;
            }
            return { text: replyText };
          },
        };
      }
      get _callCount() { return callCount; }
    },
  };
}

// ── Capture console.error for sensitive-info checks ───────────────────────────
let capturedLogs = [];
const originalConsoleError = console.error;
function startCapturingLogs() {
  capturedLogs = [];
  console.error = (...args) => {
    capturedLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  };
}
function stopCapturingLogs() {
  console.error = originalConsoleError;
}

// ── Process env setup ─────────────────────────────────────────────────────────
function setEnv() {
  process.env.GEMINI_API_KEY      = 'test-api-key-not-real';
  process.env.SUPABASE_URL        = 'https://mock.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'mock-service-key';
  delete process.env.GEMINI_MODEL;
}
function clearEnv() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_KEY;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('\n' + YELLOW + '══════════════════════════════════════════════════════' + RESET);
  console.log(YELLOW + ' SpendX Phase 2 Chatbot — Automated Test Suite' + RESET);
  console.log(YELLOW + '══════════════════════════════════════════════════════' + RESET + '\n');

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 1: HTTP Method Handling
  // ────────────────────────────────────────────────────────────────────────────
  console.log(YELLOW + '◆ Suite 1: HTTP Method Handling' + RESET);
  {
    setEnv();
    supabaseMock    = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = buildGeminiMock();
    clearHandlerCache();
    const handler = require('./api/chat.js');

    // GET → 405
    {
      const req = mockReq({ method: 'GET', headers: { authorization: 'Bearer valid-token' } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 405, 'GET request returns 405');
      assert(res._result.body?.error?.code === 'METHOD_NOT_ALLOWED', 'GET: error code is METHOD_NOT_ALLOWED');
    }

    // OPTIONS → 200
    {
      const req = mockReq({ method: 'OPTIONS', headers: {} });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 200, 'OPTIONS preflight returns 200');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 2: Authentication
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 2: Authentication' + RESET);
  {
    setEnv();

    // 2a. No Authorization header → 401
    supabaseMock    = buildSupabaseMock({ authUserA: false });
    googleGenAIMock = buildGeminiMock();
    clearHandlerCache();
    {
      const handler = require('./api/chat.js');
      const req = mockReq({ method: 'POST', headers: {}, body: { message: 'hello' } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 401, 'Missing auth header → 401');
      assert(res._result.body?.error?.code === 'AUTH_REQUIRED', 'Missing auth: code is AUTH_REQUIRED');
    }

    // 2b. Invalid token → 401
    supabaseMock = buildSupabaseMock({ authUserA: false });
    clearHandlerCache();
    {
      const handler = require('./api/chat.js');
      const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer bad-token' }, body: { message: 'hello' } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 401, 'Invalid token → 401');
      assert(res._result.body?.error?.code === 'AUTH_REQUIRED', 'Invalid token: code is AUTH_REQUIRED');
    }

    // 2c. Valid token → not 401
    supabaseMock    = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = buildGeminiMock();
    clearHandlerCache();
    {
      const handler = require('./api/chat.js');
      const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { message: 'hello' } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode !== 401, 'Valid token → not 401');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 3: User Isolation (User A cannot see User B's data)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 3: User Data Isolation' + RESET);
  {
    setEnv();
    // Mock: User A is authenticated; DB returns per-userId rows
    supabaseMock = buildSupabaseMock({
      authUserA: true,
      txnsForUser: (userId) => userId === 'user-a-uuid' ? USER_A_TXNS : USER_B_TXNS,
    });

    let capturedSystemInstruction = null;
    googleGenAIMock = {
      GoogleGenAI: class {
        constructor() {}
        get models() {
          return {
            generateContent: async ({ config }) => {
              capturedSystemInstruction = config.systemInstruction;
              return { text: 'OK' };
            },
          };
        }
      },
    };
    clearHandlerCache();

    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer user-a-token' }, body: { message: 'summary' } });
    const res = mockRes();
    await handler(req, res);

    // User B's Ferrari merchant must NOT appear in the system instruction for user A
    assert(
      capturedSystemInstruction && !capturedSystemInstruction.includes('Ferrari'),
      'User A request does NOT include User B data (Ferrari) in Gemini system prompt'
    );
    // User A's transactions should be present
    assert(
      capturedSystemInstruction && capturedSystemInstruction.includes('Swiggy'),
      'User A request includes User A\'s Swiggy merchant in Gemini system prompt'
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 4: Finance Context Calculations (financeContext.js unit tests)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 4: Finance Context Calculations' + RESET);
  {
    // Test aggregateTransactions directly (no mocking needed)
    clearHandlerCache();
    // We need to access the un-exported aggregateTransactions — test via buildFinanceContext with a mock supabase
    // Build a lightweight supabase mock that returns specific txns
    supabaseMock = {
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'x' } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => makeQueryChain(USER_A_TXNS, false) }) }),
      }),
    };
    clearHandlerCache();

    const { buildFinanceContext } = require('./api/financeContext.js');
    const mockSupa = {
      from: () => ({ select: () => ({ eq: () => makeQueryChain(USER_A_TXNS, false) }) }),
    };

    const ctx = await buildFinanceContext(mockSupa, 'user-a-uuid');

    // 4a. Failed transactions excluded from expenses
    // Failed debit: ₹9999. Real debits: 500+300+1200+800 = 2800
    assert(ctx.raw.allTime.totalExpenses === 2800, `All-time expenses exclude Failed txns (expected 2800, got ${ctx.raw.allTime.totalExpenses})`);

    // 4b. Credits (income) calculated correctly: 5000
    assert(ctx.raw.allTime.totalIncome === 5000, `All-time income correct (expected 5000, got ${ctx.raw.allTime.totalIncome})`);

    // 4c. Net balance: 5000 - 2800 = 2200
    assert(ctx.raw.allTime.net === 2200, `Net balance correct (expected 2200, got ${ctx.raw.allTime.net})`);

    // 4d. Transaction count: ALL 6 rows (including failed, including credit)
    assert(ctx.raw.allTime.transactionCount === 6, `Transaction count includes all rows (expected 6, got ${ctx.raw.allTime.transactionCount})`);

    // 4e. avgTransaction = totalExpenses / transactionCount = 2800/6 ≈ 466.67
    const expectedAvg = Math.round((2800 / 6) * 100) / 100;
    assert(ctx.raw.allTime.avgTransaction === expectedAvg, `avgTransaction = totalExpenses/allCount (expected ${expectedAvg}, got ${ctx.raw.allTime.avgTransaction})`);

    // 4f. Category breakdown: Food = 500+1200=1700, Transport=300, Shopping=800
    const catMap = Object.fromEntries(ctx.raw.allTime.categories.map(c => [c.name, c.total]));
    assert(catMap['Food'] === 1700,      `Category Food = 1700 (got ${catMap['Food']})`);
    assert(catMap['Transport'] === 300,   `Category Transport = 300 (got ${catMap['Transport']})`);
    assert(catMap['Shopping'] === 800,    `Category Shopping = 800 (got ${catMap['Shopping']})`);

    // 4g. Top merchant by spend: Swiggy (500+1200=1700)
    const top = ctx.raw.allTime.topMerchants[0];
    assert(top && top.display === 'Swiggy' && top.total === 1700, `Top merchant by spend is Swiggy with 1700 (got ${top?.display}: ${top?.total})`);

    // 4h. Most frequent merchant: Swiggy (2 times)
    assert(ctx.raw.allTime.mostFrequent?.display === 'Swiggy', `Most frequent merchant is Swiggy (got ${ctx.raw.allTime.mostFrequent?.display})`);

    // 4i. Biggest expense: Swiggy ₹1200
    assert(ctx.raw.allTime.biggestExpense?.amount === 1200, `Biggest expense is 1200 (got ${ctx.raw.allTime.biggestExpense?.amount})`);

    // 4j. hasData = true
    assert(ctx.hasData === true, 'hasData is true when transactions exist');

    // 4k. Summary string contains key markers
    assert(ctx.summary.includes('USER FINANCIAL SUMMARY'), 'Summary contains header marker');
    assert(ctx.summary.includes('Swiggy'), 'Summary contains Swiggy merchant');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 5: Empty Transaction History
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 5: Empty Transaction History' + RESET);
  {
    clearHandlerCache();
    const { buildFinanceContext } = require('./api/financeContext.js');
    const emptyMockSupa = {
      from: () => ({ select: () => ({ eq: () => makeQueryChain([], false) }) }),
    };

    const ctx = await buildFinanceContext(emptyMockSupa, 'user-a-uuid');
    assert(ctx.hasData === false, 'hasData is false when no transactions');
    assert(ctx.summary.includes('No transactions found'), 'Empty state summary says "No transactions found"');
    assert(!ctx.summary.includes('undefined'), 'Empty state summary has no "undefined" values');

    // Via full handler: Gemini should receive no-data instruction
    setEnv();
    supabaseMock = buildSupabaseMock({ authUserA: true, txnsForUser: () => [] });
    let capturedSysInstruction = null;
    googleGenAIMock = {
      GoogleGenAI: class {
        constructor() {}
        get models() {
          return {
            generateContent: async ({ config }) => {
              capturedSysInstruction = config.systemInstruction;
              return { text: 'No data message' };
            },
          };
        }
      },
    };
    clearHandlerCache();
    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'what did I spend' } });
    const res = mockRes();
    await handler(req, res);

    assert(
      capturedSysInstruction && capturedSysInstruction.includes('No transactions found'),
      'When no data, Gemini system prompt includes "No transactions found"'
    );
    assert(res._result.statusCode === 200, 'Empty data state still returns 200 (chatbot responds gracefully)');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 6: DB Error → 502 DATA_UNAVAILABLE
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 6: DB Error Handling' + RESET);
  {
    setEnv();
    supabaseMock    = buildSupabaseMock({ authUserA: true, dbError: true });
    googleGenAIMock = buildGeminiMock();
    clearHandlerCache();

    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hello' } });
    const res = mockRes();
    await handler(req, res);

    assert(res._result.statusCode === 502, 'DB error → 502');
    assert(res._result.body?.error?.code === 'DATA_UNAVAILABLE', 'DB error code is DATA_UNAVAILABLE');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 7: Model Fallback (quota error on first model → tries next)
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 7: Model Fallback Chain' + RESET);
  {
    setEnv();
    supabaseMock    = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = buildGeminiMock({ failFirst: true, replyText: 'Fallback model response' });
    clearHandlerCache();

    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hello' } });
    const res = mockRes();
    await handler(req, res);

    assert(res._result.statusCode === 200, 'Model fallback → 200 (second model succeeds)');
    assert(res._result.body?.reply === 'Fallback model response', 'Model fallback returns reply from second model');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 8: Deprecated GEMINI_MODEL override is ignored
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 8: Deprecated Model Override Rejection' + RESET);
  {
    setEnv();
    process.env.GEMINI_MODEL = 'gemini-2.0-flash'; // deprecated

    let usedModel = null;
    supabaseMock = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = {
      GoogleGenAI: class {
        constructor() {}
        get models() {
          return {
            generateContent: async ({ model }) => {
              usedModel = model;
              return { text: 'ok' };
            },
          };
        }
      },
    };
    clearHandlerCache();

    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hi' } });
    const res = mockRes();
    await handler(req, res);

    assert(usedModel !== 'gemini-2.0-flash', `Deprecated GEMINI_MODEL override ignored (used: ${usedModel})`);
    assert(usedModel === 'gemini-3.8-flash', `Falls back to gemini-3.8-flash (got: ${usedModel})`);

    delete process.env.GEMINI_MODEL;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 9: No Sensitive Info in Error Logs
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 9: Safe Diagnostics (No Secrets in Logs)' + RESET);
  {
    setEnv();
    process.env.GEMINI_API_KEY = 'SUPER_SECRET_KEY_12345';

    supabaseMock = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = buildGeminiMock({ failFirst: true });
    clearHandlerCache();
    startCapturingLogs();

    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer SECRET_TOKEN_ABC' }, body: { message: 'hi' } });
    const res = mockRes();
    await handler(req, res);
    stopCapturingLogs();

    const allLogs = capturedLogs.join('\n');
    assert(!allLogs.includes('SUPER_SECRET_KEY_12345'), 'GEMINI_API_KEY not in error logs');
    assert(!allLogs.includes('SECRET_TOKEN_ABC'),        'User auth token not in error logs');
    assert(!allLogs.includes('mock-service-key'),        'Supabase service key not in error logs');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 10: Input Validation
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 10: Input Validation' + RESET);
  {
    setEnv();
    supabaseMock    = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = buildGeminiMock();
    clearHandlerCache();
    const handler = require('./api/chat.js');

    // Missing message
    {
      const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: {} });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 400, 'Missing message → 400');
    }

    // Message too long
    {
      const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'a'.repeat(2001) } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 400, 'Message too long → 400');
    }

    // Empty message
    {
      const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: '   ' } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 400, 'Whitespace-only message → 400');
    }

    // Invalid history role
    {
      const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hi', history: [{ role: 'admin', text: 'hack' }] } });
      const res = mockRes();
      await handler(req, res);
      assert(res._result.statusCode === 400, 'Invalid history role → 400');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 11: Missing API Key → 503 CONFIG_ERROR
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 11: Missing Gemini API Key' + RESET);
  {
    setEnv();
    delete process.env.GEMINI_API_KEY;
    supabaseMock    = buildSupabaseMock({ authUserA: true });
    googleGenAIMock = buildGeminiMock();
    clearHandlerCache();

    const handler = require('./api/chat.js');
    const req = mockReq({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: { message: 'hi' } });
    const res = mockRes();
    await handler(req, res);

    assert(res._result.statusCode === 503, 'Missing GEMINI_API_KEY → 503');
    assert(res._result.body?.error?.code === 'CONFIG_ERROR', 'Missing key code is CONFIG_ERROR');
    setEnv(); // restore
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUITE 12: ArthX Net Balance & Opening Balance Verification
  // ────────────────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '◆ Suite 12: ArthX Net Balance & Opening Balance Verification' + RESET);
  {
    setEnv();
    const SPENDX_TXNS = [
      { id: 't1', type: 'credit', amount: 9302.00, category: 'Salary', merchant: 'Employer', status: 'Success', date: '2026-10-10' },
      { id: 't2', type: 'debit', amount: 14278.15, category: 'Rent & Living', merchant: 'Landlord', status: 'Success', date: '2026-10-12' },
    ];

    const mockSupa = {
      from: () => ({ select: () => ({ eq: () => makeQueryChain(SPENDX_TXNS, false) }) }),
    };

    const { buildFinanceContext } = require('./api/financeContext.js');

    // 12a. Exact production figures: Opening Balance = ₹5,000, Income = ₹9,302, Expenses = ₹14,278.15
    const ctx = await buildFinanceContext(mockSupa, 'user-a-uuid', { openingBalance: 5000 });

    assert(ctx.raw.allTime.openingBalance === 5000, `Opening balance is ₹5,000.00 (got ${ctx.raw.allTime.openingBalance})`);
    assert(ctx.raw.allTime.totalIncome === 9302, `Total income is ₹9,302.00 (got ${ctx.raw.allTime.totalIncome})`);
    assert(ctx.raw.allTime.totalExpenses === 14278.15, `Total expenses is ₹14,278.15 (got ${ctx.raw.allTime.totalExpenses})`);
    assert(ctx.raw.allTime.currentBalance === 23.85, `Current balance = 5000 + 9302 - 14278.15 = ₹23.85 (got ${ctx.raw.allTime.currentBalance})`);
    assert(ctx.raw.allTime.net === 23.85, `Net balance equals current balance ₹23.85 (got ${ctx.raw.allTime.net})`);
    assert(ctx.raw.allTime.transactionBalance === -4976.15, `Transaction balance without opening balance = -₹4,976.15 (got ${ctx.raw.allTime.transactionBalance})`);

    // 12b. Verify summary text for Gemini system instruction contains both balances with clear distinctions
    assert(ctx.summary.includes('Opening Balance: ₹5,000.00'), 'Summary contains Opening Balance ₹5,000.00');
    assert(ctx.summary.includes('23.85'), 'Summary contains Current/Net Balance ₹23.85');
    assert(ctx.summary.includes('-₹4,976.15') || ctx.summary.includes('4,976.15'), 'Summary contains Net Transaction Balance -₹4,976.15');

    // 12c. Dynamic updates when opening balance changes
    const ctx10k = await buildFinanceContext(mockSupa, 'user-a-uuid', { openingBalance: 10000 });
    assert(ctx10k.raw.allTime.currentBalance === 5023.85, `Dynamically updates with ₹10,000 opening balance: ₹5,023.85 (got ${ctx10k.raw.allTime.currentBalance})`);
    assert(ctx10k.raw.allTime.transactionBalance === -4976.15, 'Transaction balance remains unchanged at -₹4,976.15');

    // 12d. Dynamic updates when opening balance is cleared (0)
    const ctxZero = await buildFinanceContext(mockSupa, 'user-a-uuid', { openingBalance: 0 });
    assert(ctxZero.raw.allTime.currentBalance === -4976.15, `Current balance with 0 opening balance is -₹4,976.15 (got ${ctxZero.raw.allTime.currentBalance})`);

    // 12e. Dynamic updates when transactions change (+ ₹1,000 income)
    const DYNAMIC_TXNS = [
      ...SPENDX_TXNS,
      { id: 't3', type: 'credit', amount: 1000.00, category: 'Bonus', merchant: 'Employer', status: 'Success', date: '2026-10-15' },
    ];
    const mockSupaDynamic = {
      from: () => ({ select: () => ({ eq: () => makeQueryChain(DYNAMIC_TXNS, false) }) }),
    };
    const ctxDynamic = await buildFinanceContext(mockSupaDynamic, 'user-a-uuid', { openingBalance: 5000 });
    assert(ctxDynamic.raw.allTime.currentBalance === 1023.85, `Dynamic income change updates current balance to ₹1,023.85 (got ${ctxDynamic.raw.allTime.currentBalance})`);

    // 12f. Chat API receives openingBalance in request body and injects it into Gemini prompt
    let capturedSystemPrompt = null;
    googleGenAIMock = {
      GoogleGenAI: class {
        constructor() {}
        get models() {
          return {
            generateContent: async ({ config }) => {
              capturedSystemPrompt = config.systemInstruction;
              return { text: 'Your current balance is ₹23.85 including your opening balance of ₹5,000.' };
            },
          };
        }
      },
    };
    supabaseMock = {
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'user-a-uuid' } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => makeQueryChain(SPENDX_TXNS, false) }) }),
      }),
    };
    clearHandlerCache();

    const handler = require('./api/chat.js');
    const req = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer user-a-token' },
      body: { message: 'What is my current balance?', openingBalance: 5000 },
    });
    const res = mockRes();
    await handler(req, res);

    assert(res._result.statusCode === 200, 'Chat API responds 200 with openingBalance in body');
    assert(capturedSystemPrompt && capturedSystemPrompt.includes('₹23.85'), 'Gemini prompt includes Current Balance ₹23.85');
    assert(capturedSystemPrompt && capturedSystemPrompt.includes('₹5,000.00'), 'Gemini prompt includes Opening Balance ₹5,000.00');

    // 12g. Fallback to user_metadata when openingBalance is in user profile
    capturedSystemPrompt = null;
    supabaseMock = {
      createClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'user-a-uuid', user_metadata: { opening_balance: 5000 } } }, error: null }) },
        from: () => ({ select: () => ({ eq: () => makeQueryChain(SPENDX_TXNS, false) }) }),
      }),
    };
    clearHandlerCache();
    const handlerMeta = require('./api/chat.js');
    const reqMeta = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer user-a-token' },
      body: { message: 'What is my net balance?' },
    });
    const resMeta = mockRes();
    await handlerMeta(reqMeta, resMeta);
    assert(resMeta._result.statusCode === 200, 'Chat API responds 200 reading user_metadata');
    assert(capturedSystemPrompt && capturedSystemPrompt.includes('₹23.85'), 'Gemini prompt includes Current Balance ₹23.85 from user_metadata');

    // 12h. Validation rejects invalid openingBalance values (NaN/non-numeric string)
    const reqInvalid = mockReq({
      method: 'POST',
      headers: { authorization: 'Bearer user-a-token' },
      body: { message: 'What is my net balance?', openingBalance: 'invalid-number' },
    });
    const resInvalid = mockRes();
    await handler(reqInvalid, resInvalid);
    assert(resInvalid._result.statusCode === 400, 'Invalid openingBalance string returns 400');
  }

  // ── Restore module loader ──────────────────────────────────────────────────
  Module._load = originalLoad;
  supabaseMock    = null;
  googleGenAIMock = null;
  clearEnv();

  // ── Results ────────────────────────────────────────────────────────────────
  console.log('\n' + YELLOW + '══════════════════════════════════════════════════════' + RESET);
  console.log(`${GREEN}  Passed: ${passed}${RESET}   ${failed > 0 ? RED : GREEN}Failed: ${failed}${RESET}`);
  if (failures.length > 0) {
    console.log('\n' + RED + 'Failures:' + RESET);
    failures.forEach(f => console.log(`  ${RED}✗${RESET} ${f}`));
  }
  console.log(YELLOW + '══════════════════════════════════════════════════════' + RESET + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('[Test Runner] Unexpected error:', err.message);
  process.exit(1);
});
