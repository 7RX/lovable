import { list, put } from '@vercel/blob';
import initial from '../data/initial-admin-state.js';

const PATHNAME='catalog/catalog.json';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});
  try{
    const existing=await list({prefix:PATHNAME,limit:20});
    const exact=existing.blobs.find(b=>b.pathname===PATHNAME);
    if(exact)return res.status(200).json({ok:true,created:false,url:exact.url});
    const payload={...initial,updatedAt:new Date().toISOString()};
    const blob=await put(PATHNAME,JSON.stringify(payload),{
      access:'public',
      allowOverwrite:false,
      addRandomSuffix:false,
      contentType:'application/json',
      cacheControlMaxAge:60
    });
    return res.status(200).json({ok:true,created:true,url:blob.url});
  }catch(error){
    console.error('init-catalog',error);
    return res.status(500).json({error:'Falha ao inicializar catálogo.'});
  }
}
