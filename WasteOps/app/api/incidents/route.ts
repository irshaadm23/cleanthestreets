import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { demoIncidents, categories, isPotentiallyHazardous, priorities, priorityFor, statuses, crews, type HazardConcern, type Incident } from '@/lib/wasteops';
import {findJob,storedId} from '@/lib/server/operations';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function owner(){const u=await getChatGPTUser();return u?.userId;}
function sameOrigin(r:Request){return !r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin;}
export async function GET(){
 const user=await owner(); if(!user)return reply({error:'Sign in to access saved reports.'},401);
 const rows=await env.DB!.prepare('SELECT data FROM incidents WHERE owner_id = ? ORDER BY created_at DESC').bind(user).all<{data:string}>();
 const jobs=await env.DB!.prepare('SELECT incident_id,data FROM work_orders WHERE owner_id=?').bind(user).all<{incident_id:string;data:string}>();
 return reply({incidents:rows.results.map(r=>{const i=JSON.parse(r.data);return {...i,job:jobs.results.find(j=>j.incident_id===i.id)?JSON.parse(jobs.results.find(j=>j.incident_id===i.id)!.data):undefined}}),storage:'connected'});
}
export async function POST(request:Request){
 const user=await owner();if(!user)return reply({error:'Sign in to save your report.'},401);
 if(!sameOrigin(request))return reply({error:'Invalid request origin.'},403);
 let b;try{b=await request.json() as Record<string,unknown>;}catch{return reply({error:'Invalid report.'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Invalid report.'},400);
 const {lat,lng,address,note,photoKey,submissionId}=b;const category=typeof b.category==='string'?b.category:'Other';const hazardConcern=b.hazardConcern as HazardConcern|undefined;
 if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180||typeof address!=='string'||address.length<3||address.length>300||typeof photoKey!=='string'||typeof submissionId!=='string'||!/^[a-z0-9-]{20,60}$/i.test(submissionId)||typeof note!=='string'||note.length>300||!categories.includes(category)||hazardConcern!==undefined&&!['yes','unsure','no'].includes(hazardConcern))return reply({error:'Add a photo and confirm a valid location.'},400);
 const existing=await env.DB!.prepare('SELECT data FROM incidents WHERE id = ? AND owner_id = ?').bind(submissionId,user).first<{data:string}>(); if(existing)return reply({incident:JSON.parse(existing.data)});
 const upload=await env.DB!.prepare('SELECT id FROM uploads WHERE id = ? AND owner_id = ?').bind(photoKey,user).first();if(!upload)return reply({error:'Photo upload could not be verified. Please try again.'},400);
 const now=new Date().toISOString();
 const count=await env.DB!.prepare('SELECT COUNT(*) AS total FROM observations WHERE owner_id=? AND created_at > ?').bind(user,new Date(Date.now()-3600000).toISOString()).first<{total:number}>();if((count?.total||0)>=20)return reply({error:'Hourly report limit reached. Please try again later.'},429);
 const reference=`WO-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`;
 const incident:Incident={id:submissionId,reference,token:crypto.randomUUID(),category,priority:priorityFor(category,hazardConcern),hazardConcern,status:'Reported',address,lat,lng,note,photo:`/api/media/${photoKey}`,crew:'',createdAt:now,events:[{text:'Report received by WasteOps. Awaiting review.',at:now}],demo:false};
 await env.DB!.batch([
 env.DB!.prepare('INSERT INTO incidents (id,owner_id,reference,token,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(incident.id,user,reference,incident.token,JSON.stringify(incident),now,now),
 env.DB!.prepare('INSERT INTO observations (id,owner_id,incident_id,photo_key,created_at) VALUES (?,?,?,?,?)').bind(submissionId,user,incident.id,photoKey,now),
 env.DB!.prepare('INSERT INTO audit (id,owner_id,incident_id,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user,incident.id,'Observation submitted',now)
 ]);
 return reply({incident},201);
}
export async function PATCH(request:Request){
 const user=await owner();if(!user)return reply({error:'Sign in to update an incident.'},401);
 if(!sameOrigin(request))return reply({error:'Invalid request origin.'},403);
 let b;try{b=await request.json() as {id?:string;status?:string;category?:string;priority?:string;hazardConcern?:HazardConcern;crew?:string;afterPhotoKey?:string;confirm?:boolean};}catch{return reply({error:'Invalid update.'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Invalid update.'},400);
 const row=await env.DB!.prepare('SELECT data FROM incidents WHERE id=? AND owner_id=?').bind(storedId(b.id||'',user),user).first<{data:string}>();
 const found=row?JSON.parse(row.data) as Incident:demoIncidents.find(i=>i.id===b.id);if(!found)return reply({error:'Incident not found.'},404);
 if(found.mergedInto)return reply({error:'This observation is linked to another incident. Reverse the merge before editing.'},409);
 if(b.crew!==undefined||b.status&&['Assigned','In progress','Resolved','Reopened'].includes(b.status))return reply({error:'Use the authorised job workflow to assign work or update progress.'},409);
 if(b.category&&b.category!==found.category&&await findJob(found.id,user))return reply({error:'The incident has authorised work. Review the work order before changing its category.'},409);
 if(b.hazardConcern!==undefined&&b.hazardConcern!==found.hazardConcern&&await findJob(found.id,user))return reply({error:'The incident has authorised work. Review the work order before changing its hazard assessment.'},409);
 const i={...found,events:[...found.events]};const now=new Date().toISOString();
 if(b.category){if(!categories.includes(b.category))return reply({error:'Invalid category.'},400);i.category=b.category;}
 if(b.hazardConcern!==undefined){if(!['yes','unsure','no'].includes(b.hazardConcern))return reply({error:'Invalid hazard response.'},400);i.hazardConcern=b.hazardConcern;}
 if(i.crew&&!crews.some(c=>c.name===i.crew&&c.capabilities.includes(i.category)&&(!isPotentiallyHazardous(i.category,i.hazardConcern)||c.capabilities.includes('Hazardous material')))){i.crew='';i.status='Under review';}
 if(b.priority!==undefined){if(!priorities.includes(b.priority as typeof priorities[number]))return reply({error:'Invalid priority.'},400);i.priority=b.priority as typeof priorities[number];}
 else if(b.category!==undefined||b.hazardConcern!==undefined)i.priority=priorityFor(i.category,i.hazardConcern);
 if(b.crew!==undefined){if(b.crew&&!crews.some(c=>c.name===b.crew&&c.capabilities.includes(i.category)&&(!isPotentiallyHazardous(i.category,i.hazardConcern)||c.capabilities.includes('Hazardous material'))))return reply({error:'Choose a crew with the right capabilities. Potentially hazardous reports require a specialist response crew.'},400);i.crew=b.crew;}
 if(b.status){if(!statuses.includes(b.status))return reply({error:'Invalid status.'},400);if(['Assigned','In progress'].includes(b.status)&&!i.crew)return reply({error:'Assign a suitable crew first.'},400);if(b.status==='Resolved'&&!i.demo&&!b.afterPhotoKey&&!i.afterPhoto)return reply({error:'Add an after photo before resolving this incident.'},400);i.status=b.status;}
 const existingJob=await findJob(i.id,user);
 if(b.afterPhotoKey&&existingJob?.status==='Accepted')return reply({error:'Accepted evidence is locked. Dispute the completion before replacing it.'},409);
 if(b.afterPhotoKey&&existingJob&&existingJob.status!=='Completed')return reply({error:'Mark cleaning finished before adding the completion photo.'},409);
 if(b.afterPhotoKey){const up=await env.DB!.prepare('SELECT id FROM uploads WHERE id=? AND owner_id=?').bind(b.afterPhotoKey,user).first();if(!up)return reply({error:'After photo could not be verified.'},400);i.afterPhoto=`/api/media/${b.afterPhotoKey}`;}
 if(b.confirm){if(i.confirmed)return reply({incident:i});i.confirmed=true;}
 const action=b.confirm?'Still there confirmed':b.priority!==undefined?`Priority changed to ${i.priority?.toLowerCase()}`:b.status?`Status updated to ${i.status.toLowerCase()}`:b.crew!==undefined?`Assigned to ${i.crew||'no crew'}`:b.afterPhotoKey?'After-cleaning photo added; awaiting review':b.category!==undefined||b.hazardConcern!==undefined?'Issue type or hazard assessment updated':'Information reviewed';
 i.events.push({text:action,at:now});
 const statements=[env.DB!.prepare('INSERT INTO incidents (id,owner_id,reference,token,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE owner_id=excluded.owner_id').bind(storedId(i.id,user),user,i.reference,i.token||crypto.randomUUID(),JSON.stringify(i),i.createdAt,now),env.DB!.prepare('INSERT INTO audit (id,owner_id,incident_id,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user,i.id,action,now)];
 if(b.afterPhotoKey&&existingJob?.status==='Completed'){
  existingJob.status='Evidence submitted';existingJob.updatedAt=now;existingJob.events.push({text:action,at:now});
  statements.push(env.DB!.prepare('INSERT INTO work_orders (id,owner_id,incident_id,data,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE owner_id=excluded.owner_id').bind(existingJob.id,user,i.id,JSON.stringify(existingJob),now));
 }
 if(b.crew)statements.push(env.DB!.prepare('INSERT INTO jobs (id,owner_id,incident_id,crew,status,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),user,i.id,b.crew,i.status,now));
 await env.DB!.batch(statements);return reply({incident:{...i,job:await findJob(i.id,user)}});
}
