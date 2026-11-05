import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const u=await getChatGPTUser();if(!u)return new Response('Sign in required',{status:401});
 const {id}=await params;
 const upload=await env.DB!.prepare('SELECT id FROM uploads WHERE id=? AND owner_id=?').bind(id,u.userId).first();if(!upload)return new Response('Not found',{status:404});
 const object=await env.BUCKET!.get(id);if(!object)return new Response('Not found',{status:404});
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
