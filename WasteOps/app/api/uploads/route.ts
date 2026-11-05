import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const u=await getChatGPTUser();if(!u)return Response.json({error:'Sign in to upload photos.'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
 if(Number(request.headers.get('content-length'))>11000000)return Response.json({error:'Photo must be smaller than 10 MB.'},{status:413});
 let form:FormData;try{form=await request.formData()}catch{return Response.json({error:'Upload a photo using the file picker.'},{status:400})}const file=form.get('photo');
 if(!(file instanceof File)||file.size>10000000||file.size===0)return Response.json({error:'Choose a photo smaller than 10 MB.'},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer());
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!jpeg&&!png&&!webp)return Response.json({error:'Use a JPG, PNG or WebP photo.'},{status:400});
 const count=await env.DB!.prepare('SELECT COUNT(*) AS total FROM uploads WHERE owner_id=? AND created_at > ?').bind(u.userId,new Date(Date.now()-3600000).toISOString()).first<{total:number}>();if((count?.total||0)>=40)return Response.json({error:'Upload limit reached. Try again later.'},{status:429});
 const id=crypto.randomUUID();await env.BUCKET!.put(id,bytes,{httpMetadata:{contentType:jpeg?'image/jpeg':png?'image/png':'image/webp'},customMetadata:{owner:u.userId}});
 await env.DB!.prepare('INSERT INTO uploads (id,owner_id,created_at) VALUES (?,?,?)').bind(id,u.userId,new Date().toISOString()).run();
 return Response.json({key:id,url:`/api/media/${id}`},{headers:{'Cache-Control':'private, no-store'}});
}
