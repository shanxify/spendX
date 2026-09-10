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

    const { method } = req;

    if (method === 'POST') {
      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
      }

      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        email: user.email,
        message: message.trim()
      });

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Feedback error:', err);
    let msg = err.message || 'An error occurred processing feedback.';
    if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      msg = 'Database connection failed: The database host could not be resolved. This usually means the Supabase project is paused or deleted. Please restore your project in the Supabase Dashboard (https://supabase.com/dashboard).';
    }
    res.status(500).json({ error: msg });
  }
};
