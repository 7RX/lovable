export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  const origin='https://www.tangiershookahshop.com';
  const start=['/','/carvoes-e-aluminios','/essencias-','/essencias-convencionais-50g','/arguiles','/rosh','/vasos','/acessorios'];
  const normalize=(href)=>{try{if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:'))return null;const u=new URL(href,origin);if(u.origin!==origin)return null;u.hash='';['utm_source','utm_medium','utm_campaign'].forEach(k=>u.searchParams.delete(k));return u.pathname+(u.search||'')}catch{return null}};
  const skip=/\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|pdf)(\?|$)/i;
  const bad=/(\/login|\/carrinho|\/checkout|\/contato|\/empresa|\/como-comprar|\/seguranca|\/envio|\/pagamento|\/trocas|\/garantia|\/minha-conta|\/loja\/busca|\/newsletter)/i;
  const seen=new Set(), queue=[...start], pages=[], productMap=new Map();
  const maxPages=Number(req.query.max||120);
  while(queue.length&&seen.size<maxPages){
    const batch=[];
    while(queue.length&&batch.length<10&&seen.size+batch.length<maxPages){const p=queue.shift();if(!p||seen.has(p)||skip.test(p)||bad.test(p))continue;seen.add(p);batch.push(p)}
    const rs=await Promise.all(batch.map(async path=>{try{const r=await fetch(origin+path,{headers:{'user-agent':'Mozilla/5.0'}});return{path,status:r.status,html:await r.text()}}catch(e){return{path,status:0,html:'',error:String(e)}}}));
    for(const it of rs){
      if(!it.html)continue;const html=it.html;
      const title=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]?.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      const priceMatch=html.match(/R\$\s*(?:\(BRL\)\s*)?([0-9\.]+,[0-9]{2})/i);
      const hasBuy=/Disponibilidade:\s*Imediata|>Comprar<|Produto indisponível/i.test(html);
      const productish=!!title&&hasBuy&&!!priceMatch;
      if(productish){
        const price=Number(priceMatch[1].replace(/\./g,'').replace(',','.'));
        const brand=(html.match(/Marca:\s*(?:<[^>]+>)*\s*-?\s*([^<\n]+)/i)||[])[1]?.replace(/&[^;]+;/g,' ').trim()||'';
        const imgs=[...html.matchAll(/<img[^>]+(?:src|data-src)=[\"']([^\"']+)[\"'][^>]*>/gi)].map(m=>m[1]).filter(x=>/images\.tcdn\.com\.br\/img\/img_prod\/1486411/i.test(x));
        productMap.set(it.path,{path:it.path,title,price,brand,image:imgs[0]||'',available:!/Produto indisponível|Esse acabou/i.test(html)});
      }
      for(const m of html.matchAll(/href=[\"']([^\"']+)[\"']/gi)){const n=normalize(m[1]);if(!n||seen.has(n)||skip.test(n)||bad.test(n))continue;if(n.split('/').filter(Boolean).length<=3&&!n.includes('sort='))queue.push(n)}
      pages.push({path:it.path,status:it.status,title,productish});
    }
  }
  res.status(200).json({count:productMap.size,seen:seen.size,products:[...productMap.values()],pages});
}