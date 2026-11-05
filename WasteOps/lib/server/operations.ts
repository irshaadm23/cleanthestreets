import { env } from 'cloudflare:workers';
import {demoIncidents, type Incident, type WorkOrder} from '@/lib/wasteops';
export const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export const sameOrigin=(r:Request)=>!r.headers.get('origin')||r.headers.get('origin')===new URL(r.url).origin;
export const storedId=(id:string,user:string)=>id.startsWith('demo-')?`${user}::${id}`:id;
export async function findIncident(id:string,user:string):Promise<Incident|null>{
 const row=await env.DB!.prepare('SELECT data FROM incidents WHERE owner_id=? AND (id=? OR id=?) LIMIT 1').bind(user,storedId(id,user),id).first<{data:string}>();
 const example=demoIncidents.find(i=>i.id===id);return row?JSON.parse(row.data):example?structuredClone(example):null;
}
export async function findJob(id:string,user:string):Promise<WorkOrder|null>{
 const row=await env.DB!.prepare('SELECT data FROM work_orders WHERE owner_id=? AND incident_id=? LIMIT 1').bind(user,id).first<{data:string}>();
 return row?JSON.parse(row.data):null;
}
export function incidentStatement(i:Incident,user:string){
 const {job,...record}=i;
 return env.DB!.prepare('INSERT INTO incidents (id,owner_id,reference,token,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE owner_id=excluded.owner_id').bind(storedId(i.id,user),user,i.reference,i.token||crypto.randomUUID(),JSON.stringify(record),i.createdAt,new Date().toISOString());
}
export function auditStatement(user:string,id:string,action:string){return env.DB!.prepare('INSERT INTO audit (id,owner_id,incident_id,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),user,id,action,new Date().toISOString())}
