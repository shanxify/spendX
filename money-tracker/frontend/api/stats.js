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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - please log in' });
    }

    const { data: transactions, error } = await supabase.from('transactions').select('*').eq('user_id', user.id);
    if (error) throw error;

    const txns = transactions || [];
    const totalExpenses = txns.filter(t => t.type === 'debit').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalIncome = txns.filter(t => t.type === 'credit').reduce((s, t) => s + parseFloat(t.amount || 0), 0);

    const catMap = {};
    txns.filter(t => t.type === 'debit').forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { name: cat, total: 0, count: 0 };
      catMap[cat].total += parseFloat(t.amount || 0);
      catMap[cat].count++;
    });
    const grandTotal = Object.values(catMap).reduce((s, c) => s + c.total, 0);
    const categoryBreakdown = Object.values(catMap)
      .map(c => ({ ...c, total: Math.round(c.total * 100) / 100, percentage: grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : '0' }))
      .sort((a, b) => b.total - a.total);

    const monthMap = {};
    txns.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!monthMap[key]) monthMap[key] = { key, label, debit: 0, credit: 0, count: 0 };
      if (t.type === 'debit') monthMap[key].debit += parseFloat(t.amount || 0);
      else monthMap[key].credit += parseFloat(t.amount || 0);
      monthMap[key].count++;
    });
    const monthlyData = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key))
      .map(m => ({ ...m, debit: Math.round(m.debit * 100) / 100, credit: Math.round(m.credit * 100) / 100 }));

    const mMap = {};
    txns.filter(t => t.type === 'debit').forEach(t => {
      const key = t.normalizedMerchant || t.merchant;
      if (!mMap[key]) mMap[key] = { display: t.merchant, category: t.category, total: 0, count: 0 };
      mMap[key].total += parseFloat(t.amount || 0);
      mMap[key].count++;
    });
    const topMerchants = Object.values(mMap).sort((a, b) => b.total - a.total).slice(0, 5)
      .map(m => ({ ...m, total: Math.round(m.total * 100) / 100 }));

    const recentTransactions = txns.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    const lastUpdated = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].label : 'No data';

    res.json({
      totals: { expenses: Math.round(totalExpenses * 100) / 100, income: Math.round(totalIncome * 100) / 100, net: Math.round((totalIncome - totalExpenses) * 100) / 100, transactionCount: txns.length },
      categoryBreakdown, monthlyData, topMerchants, recentTransactions, lastUpdated
    });
  } catch (err) {
    console.error('Stats error:', err);
    let msg = err.message || 'An error occurred fetching stats.';
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      msg = 'Database connection failed: The database host could not be resolved. This usually means the Supabase project is paused or deleted. Please restore your project in the Supabase Dashboard (https://supabase.com/dashboard).';
    }
    res.status(500).json({ error: msg });
  }
};
