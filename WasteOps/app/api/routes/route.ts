import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {crews,isPotentiallyHazardous,type RoutePlan} from '@/lib/wasteops';
import {reply,sameOrigin,findIncident,findJob,auditStatement} from '@/lib/server/operations';
export const dynamic='force-dynamic';
export async function GET(){const user=(await getChatGPTUser())?.userId;if(!user)return reply({error:'Sign in required.'},401);const rows=await env.DB!.prepare('SELECT data FROM route_plans WHERE owner_id=?').bind(user).all<{data:string}>();return reply({plans:rows.results.map(r=>JSON.parse(r.data))})}
export async function POST(request:Request){
 const user=(await getChatGPTUser())?.userId;if(!user)return reply({error:'Sign in required.'},401);if(!sameOrigin(request))return reply({error:'Invalid origin.'},403);
 let b:{crew?:string;day?:string;stops?:string[]};try{b=await request.json()}catch{return reply({error:'Invalid route.'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Invalid route.'},400);
 const crew=crews.find(c=>c.name===b.crew);if(!crew||!b.day||!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||!Array.isArray(b.stops)||b.stops.length>40||b.stops.some(x=>typeof x!=='string')||new Set(b.stops).size!==b.stops.length)return reply({error:'Choose a crew, date and unique stop list.'},400);
 for(const id of b.stops){const i=await findIncident(id,user);const job=await findJob(id,user);if(!i||i.mergedInto||!job||job.crew!==crew.name||!['Assigned','Travelling','Arrived','Working'].includes(job.status)||!crew.capabilities.includes(i.category)||isPotentiallyHazardous(i.category,i.hazardConcern)&&!crew.capabilities.includes('Hazardous material'))return reply({error:'Every stop must be an authorised, active job assigned to a suitably capable crew. Potentially hazardous reports require a specialist response crew.'},409)}
 const id=`${user}:${crew.name}:${b.day}`;const now=new Date().toISOString();const plan:RoutePlan={id,crew:crew.name,day:b.day,stops:b.stops,approvedAt:now};
 await env.DB!.batch([env.DB!.prepare('INSERT INTO route_plans (id,owner_id,crew,day,data,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE owner_id=excluded.owner_id').bind(id,user,crew.name,b.day,JSON.stringify(plan),now),auditStatement(user,'route',`Supervisor approved ${crew.name} route for ${b.day}: ${b.stops.length} stops`)]);
 return reply({plan});
}
