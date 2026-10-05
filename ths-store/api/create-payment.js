import crypto from 'node:crypto';
import { list } from '@vercel/blob';
import paymentCatalog from '../payment-catalog.js';

const CATALOG_PATH = 'catalog/catalog.json';
const ELIGIBLE_CATEGORIES = new Set([
  'Arguiles',
  'Rosh',
  'Bases',
  'Carvões e Alumínios',
  'Acessórios',
  'Mangueiras',
  'Controladores',
  'Fogareiros'
]);
const REGULATED_PATTERN = /(ess[eê]ncia|tobacco|tabaco|nicotin)/i;

function isEligibleProduct(product = {}) {
  const haystack = [
    product.name,
    product.brand,
    product.category,
    product.description
  ].filter(Boolean).join(' ');
  return ELIGIBLE_CATEGORIES.has(String(product.category || '')) &&
    !REGULATED_PATTERN.test(haystack);
}

function asMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function loadRemoteCatalog() {
  try {
    const result = await list({ prefix: CATALOG_PATH, limit: 20 });
    const exact = result.blobs.find((b) => b.pathname === CATALOG_PATH) || result.blobs[0];
    if (!exact) return null;
    const response = await fetch(exact.url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function buildCatalog(remote) {
  const overrides = remote?.overrides && typeof remote.overrides === 'object' ? remote.overrides : {};
  const hidden = new Set(Array.isArray(remote?.hiddenProducts) ? remote.hiddenProducts : []);
  const custom = Array.isArray(remote?.customProducts) ? remote.customProducts : [];

  const products = paymentCatalog
    .filter((p) => !hidden.has(p.id))
    .map((p) => ({ ...p, ...(overrides[p.id] || {}) }));

  for (const p of custom) {
    if (!p?.id || hidden.has(p.id)) continue;
    products.push({ ...p, ...(overrides[p.id] || {}) });
  }

  return new Map(products.filter(isEligibleProduct).map((p) => [String(p.id), p]));
}

function siteBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return 'https://ths-store-2.vercel.app';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || '';
  if (!token) {
    return res.status(503).json({
      error: 'Mercado Pago ainda não foi ativado no servidor.',
      code: 'PAYMENT_NOT_CONFIGURED'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const requested = Array.isArray(body?.items) ? body.items : [];
    const email = String(body?.email || '').trim();

    if (!requested.length || requested.length > 30) {
      return res.status(400).json({ error: 'Carrinho inválido.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Informe um e-mail válido.' });
    }

    const remote = await loadRemoteCatalog();
    const storeConfig = remote?.storeConfig && typeof remote.storeConfig === 'object'
      ? remote.storeConfig
      : {};

    if (storeConfig.paymentCheckoutEnabled !== true) {
      return res.status(503).json({
        error: 'O pagamento online ainda não foi ativado no painel.',
        code: 'CHECKOUT_DISABLED'
      });
    }

    const catalog = buildCatalog(remote);
    const orderItems = [];

    for (const entry of requested) {
      const id = String(entry?.id || '');
      const qty = Math.max(1, Math.min(20, Number.parseInt(entry?.qty, 10) || 1));
      const product = catalog.get(id);

      if (!product || !isEligibleProduct(product)) {
        return res.status(400).json({
          error: 'Este carrinho contém um produto que não pode ser pago online.',
          code: 'INELIGIBLE_PRODUCT'
        });
      }
      if (product.available === false) {
        return res.status(400).json({ error: `${product.name} está indisponível.` });
      }

      const price = asMoney(product.price);
      if (!price) {
        return res.status(400).json({ error: `${product.name} está sem preço válido.` });
      }

      const variant = String(entry?.variant || '').trim().slice(0, 80);
      const title = variant ? `${product.name} — ${variant}` : product.name;
      orderItems.push({
        title: String(title).slice(0, 250),
        quantity: qty,
        unit_price: price.toFixed(2),
        unit_measure: 'unit',
        total_amount: (price * qty).toFixed(2)
      });
    }

    const shippingFee = Math.max(0, Number(storeConfig.checkoutShippingFee || 0) || 0);
    if (shippingFee > 0) {
      orderItems.push({
        title: 'Frete',
        quantity: 1,
        unit_price: shippingFee.toFixed(2),
        unit_measure: 'unit',
        total_amount: shippingFee.toFixed(2)
      });
    }

    const total = orderItems.reduce((sum, item) => sum + Number(item.total_amount), 0);
    const reference = 'THS-' + Date.now().toString(36).toUpperCase();
    const base = siteBase(req);

    const payload = {
      type: 'online',
      processing_mode: 'manual',
      capture_mode: 'automatic_async',
      total_amount: total.toFixed(2),
      external_reference: reference,
      items: orderItems,
      config: {
        online: {
          success_url: base + '/#/pagamento-sucesso',
          failure_url: base + '/#/pagamento-falhou',
          pending_url: base + '/#/pagamento-pendente',
          auto_return: 'all'
        }
      }
    };
    if (email) payload.payer = { email };

    const mp = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer ' + token,
        'x-idempotency-key': crypto.randomUUID()
      },
      body: JSON.stringify(payload)
    });

    const data = await mp.json().catch(() => ({}));
    if (!mp.ok || !data?.checkout_url) {
      console.error('mercado-pago-create-order', mp.status, data);
      return res.status(502).json({
        error: 'Não foi possível iniciar o pagamento no Mercado Pago.'
      });
    }

    return res.status(200).json({
      ok: true,
      orderId: data.id || null,
      checkoutUrl: data.checkout_url,
      externalReference: reference
    });
  } catch (error) {
    console.error('create-payment', error);
    return res.status(500).json({ error: 'Não foi possível iniciar o pagamento.' });
  }
}
