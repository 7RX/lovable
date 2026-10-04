export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  const provided = req.headers['x-admin-key'] || '';
  const expected = process.env.THS_ADMIN_KEY || '';
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
  }
  return res.status(200).json({ ok: true });
}
