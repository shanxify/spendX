const assert = require('assert');
const fs = require('fs');

// Helpers to simulate mock HTTP req / res
function createReq({ method = 'POST', headers = {}, body = {} } = {}) {
  return {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer valid-user-token',
      ...headers,
    },
    body,
  };
}

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    ended: false,
    body: null,
    setHeader(key, val) {
      res.headers[key.toLowerCase()] = val;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      res.ended = true;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res;
}

// Intercept chat.js logic with mockable Gemini & Auth
function loadChatWithMocks(mockGenerateContent) {
  const originalCode = fs.readFileSync('C:/Users/sudha/OneDrive/Desktop/proj/money-tracker/frontend/api/chat.js', 'utf8');

  // Replace getAuthenticatedClient with predictable mock
  let testCode = originalCode.replace(
    /async function getAuthenticatedClient\(req\) \{[\s\S]*?\n\}/,
    `async function getAuthenticatedClient(req) {
      if (req.headers.authorization === 'Bearer valid-user-token') {
        return { supabase: {}, user: { id: req.headers['x-user-id'] || 'test-user-id' } };
      }
      return { supabase: null, user: null };
    }`
  );

  // Replace GoogleGenAI instantiation with mock
  testCode = testCode.replace(
    /const ai = new GoogleGenAI\(\{ apiKey \}\);/,
    `const ai = {
      models: {
        generateContent: global.__mockGenerateContent
      }
    };`
  );

  global.__mockGenerateContent = mockGenerateContent;

  const tempFilePath = require('path').join(__dirname, '.temp_chat_mock.js');
  fs.writeFileSync(tempFilePath, testCode, 'utf8');
  delete require.cache[require.resolve(tempFilePath)];
  return require(tempFilePath);
}

async function runTestSuite() {
  console.log('========================================================');
  console.log('🧪 RUNNING GEMINI CHATBOT UNIT & INTEGRATION TEST SUITE');
  console.log('========================================================\n');

  process.env.GEMINI_API_KEY = 'mock-test-key';

  // ── TEST 1: Unauthenticated request ─────────────────────────────
  {
    const handler = loadChatWithMocks(async () => ({ text: 'mock' }));
    const req = createReq({ headers: { authorization: 'Bearer invalid-token' }, body: { message: 'hi' } });
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 401, 'Should return 401 when token invalid');
    assert.strictEqual(res.body.error.code, 'AUTH_REQUIRED');
    console.log('✅ Test 1 Passed: Unauthenticated request rejected with HTTP 401');
  }

  // ── TEST 2: Successful Gemini Response ──────────────────────────
  {
    let capturedParams = null;
    const handler = loadChatWithMocks(async (params) => {
      capturedParams = params;
      return { text: 'Here are 3 budgeting tips for SpendX: 1. Track daily, 2. Set limits, 3. Review monthly.' };
    });

    const req = createReq({ body: { message: 'Give me budgeting tips' } });
    const res = createRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200, 'Should return 200 on success');
    assert(res.body.reply.includes('budgeting tips'), 'Reply should match expected response');
    assert.strictEqual(capturedParams.model, 'gemini-3.8-flash', 'Default model must be gemini-3.8-flash');
    assert.strictEqual(typeof capturedParams.config.systemInstruction, 'string', 'Config must contain systemInstruction');
    assert(capturedParams.config.abortSignal, 'Config must pass abortSignal');
    console.log('✅ Test 2 Passed: Successful response with gemini-3.8-flash & correct SDK options');
  }

  // ── TEST 3: Invalid API Key ─────────────────────────────────────
  {
    const handler = loadChatWithMocks(async () => {
      const err = new Error('API key not valid. Please pass a valid API key.');
      err.status = 400;
      throw err;
    });

    const req = createReq({ body: { message: 'Hello' } });
    const res = createRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 503, 'Should return 503 on invalid API key');
    assert.strictEqual(res.body.error.code, 'CONFIG_ERROR');
    console.log('✅ Test 3 Passed: Invalid API key returns safe HTTP 503 CONFIG_ERROR');
  }

  // ── TEST 4: Unsupported model with automatic fallback ───────────
  {
    const attemptedModels = [];
    const handler = loadChatWithMocks(async (params) => {
      attemptedModels.push(params.model);
      if (params.model === 'gemini-3.8-flash') {
        const err = new Error('models/gemini-3.8-flash is not found or unsupported');
        err.status = 404;
        throw err;
      }
      return { text: 'Fallback response from ' + params.model };
    });

    const req = createReq({ body: { message: 'Hello fallback' } });
    const res = createRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 200, 'Should succeed on fallback model');
    assert(res.body.reply.includes('gemini-2.5-flash'), 'Should receive response from fallback model');
    assert.deepStrictEqual(attemptedModels, ['gemini-3.8-flash', 'gemini-2.5-flash'], 'Should have attempted 3.8 then 2.5');
    console.log('✅ Test 4 Passed: Automatic fallback from gemini-3.8-flash to gemini-2.5-flash');
  }

  // ── TEST 5: All models unsupported ──────────────────────────────
  {
    const handler = loadChatWithMocks(async () => {
      const err = new Error('Model not found');
      err.status = 404;
      throw err;
    });

    const req = createReq({ body: { message: 'Test model failure' } });
    const res = createRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 503, 'Should return 503 when all models fail');
    assert.strictEqual(res.body.error.code, 'MODEL_UNAVAILABLE');
    console.log('✅ Test 5 Passed: Exhausted models return safe MODEL_UNAVAILABLE');
  }

  // ── TEST 6: Deprecated model override (gemini-2.0-flash ignored) ─
  {
    process.env.GEMINI_MODEL = 'gemini-2.0-flash'; // simulate bad override in Vercel/env
    let attemptedModel = null;
    const handler = loadChatWithMocks(async (params) => {
      attemptedModel = params.model;
      return { text: 'Safe model response' };
    });

    const req = createReq({ body: { message: 'Hi' } });
    const res = createRes();
    await handler(req, res);

    assert.notStrictEqual(attemptedModel, 'gemini-2.0-flash', 'Must NOT use deprecated gemini-2.0-flash');
    assert.strictEqual(attemptedModel, 'gemini-3.8-flash', 'Must use supported model instead');
    assert.strictEqual(res.statusCode, 200);
    delete process.env.GEMINI_MODEL;
    console.log('✅ Test 6 Passed: Deprecated gemini-2.0-flash override safely ignored');
  }

  // ── TEST 7: Quota / Rate limit error ────────────────────────────
  {
    const handler = loadChatWithMocks(async () => {
      const err = new Error('Resource has been exhausted (e.g. check quota).');
      err.status = 429;
      throw err;
    });

    const req = createReq({ body: { message: 'Exhaust quota test' } });
    const res = createRes();
    await handler(req, res);

    assert.strictEqual(res.statusCode, 429, 'Should return 429 on quota exhaustion');
    assert.strictEqual(res.body.error.code, 'AI_QUOTA_EXCEEDED');
    console.log('✅ Test 7 Passed: Quota error returns safe HTTP 429 AI_QUOTA_EXCEEDED');
  }

  // ── TEST 8: Safe Diagnostics (No secret leaks in logs) ───────────
  {
    let capturedLog = null;
    const originalConsoleError = console.error;
    console.error = (...args) => {
      capturedLog = args;
    };

    const handler = loadChatWithMocks(async () => {
      const err = new Error('Database connection failed with credentials ABC123XYZ');
      err.status = 500;
      err.requestId = 'req-123456';
      throw err;
    });

    const req = createReq({ body: { message: 'Private message' } });
    const res = createRes();
    await handler(req, res);

    console.error = originalConsoleError;

    const logString = JSON.stringify(capturedLog);
    assert(!logString.includes('ABC123XYZ'), 'Log must not contain secrets');
    assert(!logString.includes('Private message'), 'Log must not contain user message text');
    assert(logString.includes('req-123456'), 'Log must include request ID');
    assert(logString.includes('PROVIDER_ERROR'), 'Log must categorize error');
    console.log('✅ Test 8 Passed: Safe diagnostics verified (0 secrets or user content in logs)');
  }

  // Clean up mock file
  try {
    fs.unlinkSync(require('path').join(__dirname, '.temp_chat_mock.js'));
  } catch (e) {}

  console.log('\n========================================================');
  console.log('🎉 ALL 8 TESTS COMPLETED & PASSED SUCCESSFULLY!');
  console.log('========================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
