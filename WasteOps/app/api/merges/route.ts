import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {reply,sameOrigin,findIncident,findJob,incidentStatement,auditStatement} from '@/lib/server/operations';
export const dynamic='force-dynamic';
export async function GET(){const user=(await getChatGPTUser())?.userId;if(!user)return reply({error:'Sign in required.'},401);const rows=await env.DB!.prepare('SELECT id,source_id as sourceId,target_id as targetId,created_at as createdAt FROM incident_merges WHERE owner_id=? AND reversed_at IS NULL').bind(user).all();return reply({merges:rows.results})}
export async function POST(request:Request){
 const user=(await getChatGPTUser())?.userId;if(!user)return reply({error:'Sign in required.'},401);if(!sameOrigin(request))return reply({error:'Invalid origin.'},403);
 let b:Record<string,unknown>;try{b=await request.json()}catch{return reply({error:'Invalid merge.'},400)}if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Invalid request.'},400);const now=new Date().toISOString();
 if(b.action==='reverse'&&typeof b.id==='string'){
  const merge=await env.DB!.prepare('SELECT * FROM incident_merges WHERE id=? AND owner_id=? AND reversed_at IS NULL').bind(b.id,user).first<{source_id:string;target_id:string;data:string}>();if(!merge)return reply({error:'Active merge not found.'},404);
  const source=await findIncident(merge.source_id,user);const target=await findIncident(merge.target_id,user);if(!source||!target)return reply({error:'Incident not found.'},404);
  delete source.mergedInto;source.events.push({text:'Merge reversed; original incident restored',at:now});target.events.push({text:`Merge with ${source.reference} reversed`,at:now});
  await env.DB!.batch([incidentStatement(source,user),incidentStatement(target,user),env.DB!.prepare('UPDATE observations SET incident_id=? WHERE owner_id=? AND id IN (SELECT value FROM json_each(?))').bind(source.id,user,merge.data),env.DB!.prepare('UPDATE incident_merges SET reversed_at=? WHERE id=? AND owner_id=?').bind(now,b.id,user),auditStatement(user,source.id,'Incident merge reversed')]);return reply({ok:true});
 }
 if(typeof b.sourceId!=='string'||typeof b.targetId!=='string'||b.sourceId===b.targetId)return reply({error:'Choose two distinct incidents.'},400);
 const source=await findIncident(b.sourceId,user);const target=await findIncident(b.targetId,user);if(!source||!target||source.mergedInto||target.mergedInto)return reply({error:'Incident unavailable.'},404);
 if(await findJob(source.id,user)||source.crew||source.status==='Resolved'||target.status==='Resolved')return reply({error:'Only an open, unassigned incident without an authorised job can be merged.'},409);
 const child=await env.DB!.prepare('SELECT id FROM incident_merges WHERE owner_id=? AND target_id=? AND reversed_at IS NULL').bind(user,source.id).first();if(child)return reply({error:'Reverse existing child merges before merging this incident.'},409);
 const obs=await env.DB!.prepare('SELECT id FROM observations WHERE incident_id=? AND owner_id=?').bind(source.id,user).all<{id:string}>();
 source.mergedInto=target.id;source.events.push({text:`Linked as a duplicate of ${target.reference}`,at:now});target.events.push({text:`Observation linked from ${source.reference}; original record retained`,at:now});
 await env.DB!.batch([incidentStatement(source,user),incidentStatement(target,user),env.DB!.prepare('UPDATE observations SET incident_id=? WHERE incident_id=? AND owner_id=?').bind(target.id,source.id,user),env.DB!.prepare('INSERT INTO incident_merges (id,owner_id,source_id,target_id,data,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),user,source.id,target.id,JSON.stringify(obs.results.map(r=>r.id)),now),auditStatement(user,source.id,`Merged into ${target.reference}`)]);return reply({ok:true});
}
