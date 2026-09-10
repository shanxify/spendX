const { createClient } = require('@supabase/supabase-js');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - please log in' });
    }

    const { url, method } = req;

    // PUT /api/merchants/bulk
    if (method === 'PUT' && url.includes('/bulk')) {
      const { merchants, category } = req.body;
      let totalUpdated = 0;
      for (const normalized of (merchants || [])) {
        let normalizedMerchant = normalized;
        let type = 'debit';
        const lastUnderscore = normalized.lastIndexOf('_');
        if (lastUnderscore !== -1) {
          normalizedMerchant = normalized.substring(0, lastUnderscore);
          type = normalized.substring(lastUnderscore + 1);
        }
        if (type === 'credit') {
          return res.status(400).json({ error: "Income transactions cannot be recategorized" });
        }
        const [txResult, upsertResult] = await Promise.all([
          supabase.from('transactions').update({ category }, { count: 'exact' }).eq('normalizedMerchant', normalizedMerchant).eq('type', type).eq('user_id', user.id),
          supabase.from('merchant_map').upsert({ normalized: normalized, category: category, user_id: user.id }, { onConflict: 'normalized,user_id' })
        ]);
        console.log('DEBUG bulk update:', { 
          normalized, normalizedMerchant, type, category,
          txResult: { data: txResult.data, count: txResult.count, error: txResult.error },
          upsertResult: { data: upsertResult.data, error: upsertResult.error }
        });
        if (txResult.error) {
          console.error('Bulk update transactions error:', txResult.error);
          return res.status(500).json({ error: txResult.error.message });
        }
        if (upsertResult.error) {
          console.error('Bulk upsert merchant_map error:', upsertResult.error);
          return res.status(500).json({ error: upsertResult.error.message });
        }
        totalUpdated += txResult.count || 0;
      }
      return res.json({ success: true, updatedTransactions: totalUpdated });
    }

    // PUT /api/merchants/:normalized
    if (method === 'PUT') {
      const parts = url.split('/merchants/');
      if (parts[1]) {
        const normalized = decodeURIComponent(parts[1].split('?')[0]);
        const { category } = req.body;
        let normalizedMerchant = normalized;
        let type = 'debit';
        const lastUnderscore = normalized.lastIndexOf('_');
        if (lastUnderscore !== -1) {
          normalizedMerchant = normalized.substring(0, lastUnderscore);
          type = normalized.substring(lastUnderscore + 1);
        }
        if (type === 'credit') {
          return res.status(400).json({ error: "Income transactions cannot be recategorized" });
        }
        try {
          const [txResult, upsertResult] = await Promise.all([
            supabase.from('transactions').update({ category }, { count: 'exact' }).eq('normalizedMerchant', normalizedMerchant).eq('type', type).eq('user_id', user.id),
            supabase.from('merchant_map').upsert({ normalized, category, user_id: user.id }, { onConflict: 'normalized,user_id' })
          ]);
          console.log('SINGLE UPDATE DEBUG:', { 
            normalized, normalizedMerchant, type, category,
            txError: txResult.error, txCount: txResult.count,
            upsertError: upsertResult.error, upsertData: upsertResult.data
          });
          if (txResult.error) return res.status(500).json({ error: txResult.error.message, detail: txResult.error });
          if (upsertResult.error) return res.status(500).json({ error: upsertResult.error.message, detail: upsertResult.error });
          return res.json({ success: true, updatedTransactions: txResult.count || 0 });
        } catch (err) {
          console.error('SINGLE UPDATE EXCEPTION:', err);
          return res.status(500).json({ error: err.message });
        }
      }
    }

    // GET /api/merchants
    if (method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const urlObj = new URL(url, 'http://localhost');
      const search = urlObj.searchParams.get('search');
      const { data: transactions, error } = await supabase.from('transactions').select('merchant, normalizedMerchant, category, amount, type').eq('user_id', user.id);
      if (error) {
        console.error('Fetch transactions error:', error);
        return res.status(500).json({ error: error.message });
      }

      const merchantMap = {};
      (transactions || []).forEach(t => {
        const key = `${t.normalizedMerchant}_${t.type}`;
        if (!merchantMap[key]) {
          merchantMap[key] = { 
            normalized: key, 
            display: t.merchant, 
            category: t.category, 
            type: t.type,
            count: 0, 
            totalAmount: 0,
            totalSpend: 0
          };
        }
        merchantMap[key].count++;
        const amountVal = parseFloat(t.amount || 0);
        merchantMap[key].totalAmount += amountVal;
        merchantMap[key].totalSpend += amountVal;
      });

      let result = Object.values(merchantMap);
      if (search) result = result.filter(m => m.display.toLowerCase().includes(search.toLowerCase()));
      result.sort((a, b) => b.totalAmount - a.totalAmount);
      return res.json(result);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Merchants error:', err);
    let msg = err.message || 'An error occurred processing merchants.';
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      msg = 'Database connection failed: The database host could not be resolved. This usually means the Supabase project is paused or deleted. Please restore your project in the Supabase Dashboard (https://supabase.com/dashboard).';
    }
    res.status(500).json({ error: msg });
  }
};
