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

    // PUT /api/categories/:id
    if (method === 'PUT') {
      const idMatch = url.match(/\/categories\/(.+)/);
      if (idMatch) {
        const id = idMatch[1];
        const { name, icon, color } = req.body;
        const { data, error } = await supabase.from('categories').update({ name, icon, color }).eq('id', id).eq('user_id', user.id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true, category: data });
      }
    }

    // DELETE /api/categories/:id
    if (method === 'DELETE') {
      const idMatch = url.match(/\/categories\/(.+)/);
      if (idMatch) {
        const id = idMatch[1];
        const { data: cat } = await supabase.from('categories').select('name').eq('id', id).eq('user_id', user.id).single();
        if (cat) await supabase.from('transactions').update({ category: 'Uncategorized' }).eq('category', cat.name).eq('user_id', user.id);
        const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
      }
    }

    // POST /api/categories
    if (method === 'POST') {
      const { v4: uuidv4 } = require('uuid');
      const { name, icon, color } = req.body;
      const { data, error } = await supabase.from('categories').insert({ id: uuidv4(), name, icon, color, user_id: user.id }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true, category: data });
    }

    // GET /api/categories
    if (method === 'GET') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('X-Debug-Version', '2.0');
      let { data: categories, error } = await supabase.from('categories').select('*').eq('user_id', user.id).order('name');
      if (error) return res.status(500).json({ error: error.message });

      // If zero categories, auto-seed default categories on the fly
      if (!categories || categories.length === 0) {
        const { v4: uuidv4 } = require('uuid');
        const defaultCategories = [
          { name: "Food & Dining", icon: "🍔", color: "#FF6B6B" },
          { name: "Groceries", icon: "🛒", color: "#4ECDC4" },
          { name: "Transport", icon: "🚗", color: "#45B7D1" },
          { name: "Shopping", icon: "🛍️", color: "#96CEB4" },
          { name: "Bills & Utilities", icon: "💡", color: "#FAD02E" },
          { name: "Mobile & Recharge", icon: "📱", color: "#A55EEA" },
          { name: "Entertainment", icon: "🎬", color: "#DDA0DD" },
          { name: "Health & Medical", icon: "🏥", color: "#88D8A3" },
          { name: "Education", icon: "📚", color: "#4B7BEC" },
          { name: "Investments", icon: "📈", color: "#2ECC71" },
          { name: "Transfers", icon: "🔁", color: "#E0E0E0" },
          { name: "Miscellaneous", icon: "🗂️", color: "#95A5A6" }
        ];

        const categoriesToInsert = defaultCategories.map(cat => ({
          id: uuidv4(),
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          user_id: user.id
        }));

        const { error: insertError } = await supabase.from('categories').insert(categoriesToInsert);
        if (insertError) {
          console.error('Error seeding default categories on GET:', insertError.message);
          return res.status(500).json({ error: 'Failed to seed default categories: ' + insertError.message });
        } else {
          // Re-fetch to get the fresh data
          const { data: refetched, error: refetchError } = await supabase.from('categories').select('*').eq('user_id', user.id).order('name');
          if (!refetchError && refetched) {
            categories = refetched;
          }
        }
      }

      const { data: txns } = await supabase.from('transactions').select('category').eq('user_id', user.id);
      const countMap = {};
      (txns || []).forEach(t => { countMap[t.category] = (countMap[t.category] || 0) + 1; });
      const result = (categories || []).map(cat => ({ ...cat, transactionCount: countMap[cat.name] || 0 }));
      return res.json(result);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Categories error:', err);
    let msg = err.message || 'An error occurred processing categories.';
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      msg = 'Database connection failed: The database host could not be resolved. This usually means the Supabase project is paused or deleted. Please restore your project in the Supabase Dashboard (https://supabase.com/dashboard).';
    }
    res.status(500).json({ error: msg });
  }
};
