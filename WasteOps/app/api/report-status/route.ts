import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
type Event={text:string;at:string};
type Report={id:string;reference:string;status:string;createdAt:string;events?:Event[]};
type WorkOrder={status:string;events?:Event[]};
const notFound=()=>Response.json({error:'We could not find that report. Check the reference and try again.'},{status:404,headers:{'Cache-Control':'no-store'}});
function publicLabel(text:string){
 const value=text.toLowerCase();
 if(value.includes('report received')||value.includes('report submitted'))return 'Report received by WasteOps';
 if(value.includes('information reviewed')||value.includes('category reviewed')||value.includes('under review'))return 'Information review';
 if(value.includes('work authorised'))return 'Work approved';
 if(value.includes('assigned to'))return 'Cleaning unit assigned';
 if(value.includes('dispatched')||value.includes('travelling'))return 'Cleaning unit dispatched';
 if(value.includes('arrived'))return 'Cleaning unit arrived';
 if(value.includes('cleaning started')||value.includes('job working'))return 'Cleaning in progress';
 if(value.includes('cleaning finished')||value.includes('job completed'))return 'Cleaning finished';
 if(value.includes('after-cleaning photo added'))return 'Completion photo added';
 if(value.includes('photo reviewed')||value.includes('accepted'))return 'Completion checked';
 if(value.includes('disputed')||value.includes('follow-up required'))return 'Further review needed';
 if(value.includes('still there'))return 'Issue reported as still present';
 if(value.includes('linked as a duplicate')||value.includes('merge'))return 'Linked to a related report';
 return null;
}
function stage(report:Report,job:WorkOrder|null){
 switch(job?.status){
  case 'Assigned':return 'Cleaning unit assigned';
  case 'Travelling':return 'Cleaning unit dispatched';
  case 'Arrived':return 'Cleaning unit arrived';
  case 'Working':return 'Cleaning in progress';
  case 'Completed':return 'Cleaning finished';
  case 'Evidence submitted':return 'Completion photo added · awaiting review';
  case 'Accepted':return 'Verified complete';
  case 'Disputed':return 'Further review needed';
 }
 if(report.status==='Under review')return 'Information review';
 if(report.status==='Assigned')return 'Work approved';
 if(report.status==='In progress')return 'Cleaning in progress';
 if(report.status==='Resolved')return 'Verified complete';
 if(report.status==='Reopened')return 'Further review needed';
 return 'Report received by WasteOps';
}
export async function GET(request:Request){
 const reference=(new URL(request.url).searchParams.get('reference')||'').trim().toUpperCase();
 // New references use 64 random bits. Older short references are not exposed to public lookup.
 if(!/^WO-\d{4}-[A-F0-9]{16}$/.test(reference))return notFound();
 const rows=await env.DB!.prepare('SELECT data FROM incidents WHERE reference=? LIMIT 2').bind(reference).all<{data:string}>();
 if(rows.results.length!==1)return notFound();
 const report=JSON.parse(rows.results[0].data) as Report;
 const jobRow=await env.DB!.prepare('SELECT data FROM work_orders WHERE incident_id=? LIMIT 1').bind(report.id).first<{data:string}>();
 const job=jobRow?JSON.parse(jobRow.data) as WorkOrder:null;
 const events=(report.events||[]).map(e=>({label:publicLabel(e.text),at:e.at})).filter((e):e is {label:string;at:string}=>!!e.label);
 const deduped=events.filter((event,index)=>!events.slice(0,index).some(previous=>previous.label===event.label));
 return Response.json({reference,stage:stage(report,job),timeline:deduped.length?deduped:[{label:'Report received by WasteOps',at:report.createdAt}]},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
