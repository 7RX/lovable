import { list, put } from '@vercel/blob';

const PATHNAME = 'catalog/catalog.json';

function getAdminKey(req) {
  return req.headers['x-admin-key'] || '';
}

function validAdmin(req) {
  const expected = process.env.THS_ADMIN_KEY || '';
  const provided = getAdminKey(req);
  return Boolean(expected && provided && provided === expected);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    try {
      const result = await list({ prefix: PATHNAME, limit: 20 });
      const exact = result.blobs.find((b) => b.pathname === PATHNAME) || result.blobs[0];
      if (!exact) {
        return res.status(200).json({ exists: false, catalog: null });
      }
      const response = await fetch(exact.url + '?v=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) {
        return res.status(200).json({ exists: false, catalog: null });
      }
      const catalog = await response.json();
      return res.status(200).json({ exists: true, catalog, updatedAt: exact.uploadedAt || null });
    } catch (error) {
      console.error('catalog-get', error);
      return res.status(500).json({ error: 'Não foi possível carregar o catálogo.' });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    if (!validAdmin(req)) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Dados inválidos.' });
      }
      const payload = {
        version: 3,
        updatedAt: new Date().toISOString(),
        overrides: body.overrides && typeof body.overrides === 'object' ? body.overrides : {},
        customProducts: Array.isArray(body.customProducts) ? body.customProducts : [],
        hiddenProducts: Array.isArray(body.hiddenProducts) ? body.hiddenProducts : [],
        categories: Array.isArray(body.categories) ? body.categories : [],
        storeConfig: body.storeConfig && typeof body.storeConfig === 'object' ? body.storeConfig : {}
      };
      const blob = await put(PATHNAME, JSON.stringify(payload), {
        access: 'public',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 60
      });
      return res.status(200).json({ ok: true, updatedAt: payload.updatedAt, url: blob.url });
    } catch (error) {
      console.error('catalog-put', error);
      return res.status(500).json({ error: 'Não foi possível salvar o catálogo.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT, POST');
  return res.status(405).json({ error: 'Método não permitido.' });
}
