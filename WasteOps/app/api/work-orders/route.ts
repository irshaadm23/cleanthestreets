import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {crews,isPotentiallyHazardous,type WorkOrder,type JobState} from '@/lib/wasteops';
import {reply,sameOrigin,findIncident,findJob,incidentStatement,auditStatement} from '@/lib/server/operations';
export const dynamic='force-dynamic';
const transitions:Record<JobState,JobState[]>={Authorised:['Assigned'],Assigned:['Travelling'],Travelling:['Arrived'],Arrived:['Working'],Working:['Completed'],Completed:[],"Evidence submitted":['Accepted','Disputed'],Accepted:['Disputed'],Disputed:['Assigned']};
export async function POST(request:Request){
 const user=(await getChatGPTUser())?.userId;if(!user)return reply({error:'Sign in required.'},401);
 if(!sameOrigin(request))return reply({error:'Invalid origin.'},403);
 let b:Record<string,unknown>;try{b=await request.json()}catch{return reply({error:'Invalid request.'},400)}
 if(!b||typeof b!=='object'||Array.isArray(b))return reply({error:'Invalid request.'},400);
 if(typeof b.incidentId!=='string')return reply({error:'Choose an incident.'},400);
 const i=await findIncident(b.incidentId,user);if(!i||i.mergedInto)return reply({error:'Incident not found or merged.'},404);
 let job=await findJob(i.id,user);const now=new Date().toISOString();let action='';
 if(b.action==='authorise'){
  if(job)return reply({incident:{...i,job}});
  if(typeof b.authority!=='string'||b.authority.trim().length<3||b.authority.length>200)return reply({error:'Record the authorising customer or pilot simulation.'},400);
  job={id:crypto.randomUUID(),incidentId:i.id,authority:b.authority.trim(),status:'Authorised',crew:'',authorisedAt:now,updatedAt:now,events:[]};i.crew='';i.status='Under review';action=`Work authorised in private pilot: ${job.authority}`;
 }else{
  if(!job)return reply({error:'Authorise the work before assigning a crew.'},409);
  if(b.action==='assign'){
   if(!['Authorised','Assigned','Disputed'].includes(job.status))return reply({error:'Work has started. Complete or dispute the current job before reassigning.'},409);
   if(typeof b.crew!=='string'||!crews.some(c=>c.name===b.crew&&c.capabilities.includes(i.category)&&(!isPotentiallyHazardous(i.category,i.hazardConcern)||c.capabilities.includes('Hazardous material'))))return reply({error:'Choose a crew with the required capabilities. Potentially hazardous reports require a specialist response crew.'},400);
   job.crew=b.crew;job.status='Assigned';i.crew=b.crew;i.status='Assigned';action=`Assigned to ${b.crew}`;
  }else if(b.action==='advance'){
   const next=b.status as JobState;
   if(!transitions[job.status]?.includes(next))return reply({error:'That job transition is not allowed.'},409);
  if(next==='Accepted'&&!i.afterPhoto)return reply({error:'Add and review an after photo before accepting completion.'},400);
   job.status=next;
   if(['Travelling','Arrived','Working','Completed'].includes(next))i.status='In progress';
   if(next==='Accepted')i.status='Resolved';
   if(next==='Disputed')i.status='Reopened';
  action=next==='Travelling'?'Cleaning unit dispatched':next==='Arrived'?'Cleaning unit arrived':next==='Working'?'Cleaning started':next==='Completed'?'Cleaning finished':next==='Accepted'?'Completion photo reviewed; report resolved':next==='Disputed'?'Completion disputed; follow-up required':`Job ${next.toLowerCase()}`;
  }else return reply({error:'Unknown action.'},400);
 }
 job.updatedAt=now;job.events.push({text:action,at:now});i.events.push({text:action,at:now});
 await env.DB!.batch([incidentStatement(i,user),env.DB!.prepare('INSERT INTO work_orders (id,owner_id,incident_id,data,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE owner_id=excluded.owner_id').bind(job.id,user,i.id,JSON.stringify(job),now),auditStatement(user,i.id,action)]);
 return reply({incident:{...i,job}});
}
