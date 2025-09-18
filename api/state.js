const { loadData } = require('../lib/dataStore');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  try {
    const data = await loadData();
    return res.status(200).json({ data });
  } catch (error) {
    console.error('Failed to load platform state.', error);
    return res.status(500).json({ error: 'Failed to load platform state.' });
  }
};
