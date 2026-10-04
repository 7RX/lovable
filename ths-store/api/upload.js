import { put } from '@vercel/blob';

function cleanName(name = 'imagem') {
  return String(name)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'imagem';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const provided = req.headers['x-admin-key'] || '';
  const expected = process.env.THS_ADMIN_KEY || '';
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const dataUrl = body?.dataUrl || '';
    const filename = cleanName(body?.filename || 'produto.jpg');
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);

    if (!match) {
      return res.status(400).json({ error: 'Arquivo inválido.' });
    }

    const contentType = match[1];
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(contentType)) {
      return res.status(400).json({ error: 'Formato de imagem não permitido.' });
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'A imagem deve ter no máximo 4 MB.' });
    }

    const blob = await put('product-images/' + Date.now() + '-' + filename, buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
      cacheControlMaxAge: 31536000
    });

    return res.status(200).json({ ok: true, url: blob.url });
  } catch (error) {
    console.error('upload', error);
    return res.status(500).json({ error: 'Não foi possível enviar a imagem.' });
  }
}
