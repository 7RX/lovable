export default async function handler(req, res) {
  const target = 'https://ths-tangiers-hookah-store.dreekcalton.chatgpt.site/';
  try {
    const r = await fetch(target, {redirect:'follow', headers:{'user-agent':'Mozilla/5.0'}});
    const html = await r.text();
    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
    const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]).slice(0,500);
    res.status(200).json({status:r.status,url:r.url,contentType:r.headers.get('content-type'),length:html.length,scripts,links,html:html.slice(0,120000)});
  } catch (e) {
    res.status(500).json({error:String(e)});
  }
}