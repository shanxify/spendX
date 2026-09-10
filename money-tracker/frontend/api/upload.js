const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');
const { extractTransactions, parseGooglePay, parsePaytm, parseGeneric } = require('./transactionExtractor');

async function getAuthenticatedClient(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return { supabase: null, user: null };
  const token = authHeader.replace('Bearer ', '');
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
}

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files accepted'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('*', upload.single('file'), async (req, res) => {
  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - please log in' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const provider = req.body.provider;
    if (!provider || !['phonepe', 'gpay', 'paytm', 'others'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid or missing provider' });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const rawText = pdfData.text;
    if (!rawText || rawText.trim().length < 50)
      return res.status(422).json({ error: 'PDF appears empty or unreadable' });

    let extractedTransactions = [];
    if (provider === 'phonepe') {
      extractedTransactions = extractTransactions(rawText);
      if (extractedTransactions.length === 0) {
        console.log('[DEBUG TEXT FROM PDF]:', rawText.substring(0, 1500));
        return res.status(422).json({ 
          error: 'No transactions found. Make sure this is a PhonePe statement PDF.'
        });
      }
    } else if (provider === 'gpay') {
      extractedTransactions = parseGooglePay(rawText);
      if (extractedTransactions.length === 0) {
        console.log('[DEBUG TEXT FROM PDF]:', rawText.substring(0, 1500));
        return res.status(422).json({ 
          error: 'No transactions found. Make sure this is a Google Pay statement PDF.'
        });
      }
    } else if (provider === 'paytm') {
      extractedTransactions = parsePaytm(rawText);
      if (extractedTransactions.length === 0) {
        console.log('[DEBUG TEXT FROM PDF]:', rawText.substring(0, 1500));
        return res.status(422).json({ 
          error: 'No transactions found. Make sure this is a Paytm statement PDF.'
        });
      }
    } else if (provider === 'others') {
      extractedTransactions = parseGeneric(rawText);
      if (extractedTransactions.length === 0)
        return res.status(422).json({ error: 'Generic parser not yet implemented' });
    }

    const { data: existingData } = await supabase
      .from('transactions')
      .select('"upiRef", "transactionId", date, amount, "normalizedMerchant"')
      .eq('user_id', user.id);
    const existing = existingData || [];

    const { data: merchantMapData } = await supabase.from('merchant_map').select('*').eq('user_id', user.id);
    const merchantMap = {};
    (merchantMapData || []).forEach(m => { merchantMap[m.normalized] = m.category; });

    const newTransactions = [];
    let duplicateCount = 0;

    for (const txn of extractedTransactions) {
      let isDuplicate = false;
      if (txn.upiRef) isDuplicate = existing.some(e => e.upiRef === txn.upiRef);
      else if (txn.transactionId) isDuplicate = existing.some(e => e.transactionId === txn.transactionId);
      else isDuplicate = existing.some(e =>
        e.date === txn.date &&
        parseFloat(e.amount) === txn.amount && e.normalizedMerchant === txn.normalizedMerchant
      );

      if (isDuplicate) { duplicateCount++; continue; }

      const compositeKey = `${txn.normalizedMerchant}_${txn.type}`;
      const mappedCategory = merchantMap[compositeKey] || merchantMap[txn.normalizedMerchant];
      const defaultCategory = txn.type === 'credit' ? 'Income' : 'Uncategorized';

      newTransactions.push({
        id: txn.id, date: txn.date,
        merchant: txn.merchant,
        normalizedMerchant: txn.normalizedMerchant,
        amount: txn.amount, type: txn.type,
        category: mappedCategory || defaultCategory,
        upiRef: txn.upiRef || null, transactionId: txn.transactionId || null,
        status: txn.status || 'Success',
        user_id: user.id
      });
    }

    if (newTransactions.length > 0) {
      const { error: insertError } = await supabase.from('transactions').insert(newTransactions);
      if (insertError) throw insertError;
    }

    res.json({ success: true, extracted: extractedTransactions.length, added: newTransactions.length, duplicates: duplicateCount });
  } catch (err) {
    console.error('Upload error:', err);
    let msg = err.message || 'An error occurred during upload.';
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      msg = 'Database connection failed: The database host could not be resolved. This usually means the Supabase project is paused or deleted. Please restore your project in the Supabase Dashboard (https://supabase.com/dashboard).';
    }
    res.status(500).json({ error: msg });
  }
});

module.exports = app;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
