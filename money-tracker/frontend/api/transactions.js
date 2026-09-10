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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - please log in' });
    }

    const { url, method } = req;

    // DELETE /api/transactions/clear
    if (method === 'DELETE' && url.includes('/clear')) {
      const { error } = await supabase.from('transactions').delete().eq('user_id', user.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, message: 'All transactions cleared' });
    }

    // DELETE /api/transactions/:id
    if (method === 'DELETE') {
      const idMatch = url.match(/\/api\/transactions\/(.+)/);
      if (idMatch) {
        const id = idMatch[1];
        const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // PUT /api/transactions/:id
    if (method === 'PUT') {
      const idMatch = url.match(/\/transactions\/(.+)/);
      if (idMatch) {
        const id = idMatch[1];
        const { category } = req.body;
        const { data, error } = await supabase.from('transactions').update({ category }).eq('id', id).eq('user_id', user.id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, transaction: data });
      }
    }

    // GET /api/transactions
    if (method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      const urlObj = new URL(url, 'http://localhost');
      const search = urlObj.searchParams.get('search');
      const category = urlObj.searchParams.get('category');
      const type = urlObj.searchParams.get('type');
      const from = urlObj.searchParams.get('from');
      const to = urlObj.searchParams.get('to');
      const page = parseInt(urlObj.searchParams.get('page') || '1');
      const limit = parseInt(urlObj.searchParams.get('limit') || '20');

      let query = supabase.from('transactions').select('*', { count: 'exact' }).eq('user_id', user.id);
      if (search) query = query.ilike('merchant', `%${search}%`);
      if (category && category !== 'All Categories' && category !== 'all') query = query.eq('category', category);
      if (type && type !== 'All Types' && type !== 'all') query = query.eq('type', type.toLowerCase());
      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);

      const start = (page - 1) * limit;
      const { data, error, count } = await query
        .order('date', { ascending: false })
        .range(start, start + limit - 1);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data || [], total: count || 0, page, totalPages: Math.ceil((count || 0) / limit), limit });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Transactions error:', err);
    let msg = err.message || 'An error occurred processing transactions.';
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      msg = 'Database connection failed: The database host could not be resolved. This usually means the Supabase project is paused or deleted. Please restore your project in the Supabase Dashboard (https://supabase.com/dashboard).';
    }
    res.status(500).json({ error: msg });
  }
};
