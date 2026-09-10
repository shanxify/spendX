const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized - please log in' });
    }

    // Check if the user already has any categories
    const { data: existingCategories, error: fetchError } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    // If they already have categories, don't seed and return successfully
    if (existingCategories && existingCategories.length > 0) {
      return res.json({ success: true, seeded: false, message: 'Categories already exist' });
    }

    // Default categories to seed
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

    const { error: insertError } = await supabase
      .from('categories')
      .insert(categoriesToInsert);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.json({ success: true, seeded: true, count: categoriesToInsert.length });
  } catch (err) {
    console.error('Seed categories error:', err);
    return res.status(500).json({ error: err.message || 'An error occurred seeding categories.' });
  }
};
