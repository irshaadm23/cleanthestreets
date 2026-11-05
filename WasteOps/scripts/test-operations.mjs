import {createRequire} from 'node:module';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler'));
const {Miniflare}=wranglerRequire('miniflare');
const {build}=wranglerRequire('esbuild');
const root=process.cwd();
await mkdir('.sites-runtime/tests',{recursive:true});
const outfile=path.join(root,'.sites-runtime/tests/worker.mjs');
await build({entryPoints:['tests/operation-worker.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile,external:['cloudflare:workers'],plugins:[{name:'test-identity',setup(b){b.onResolve({filter:/chatgpt-auth$/},()=>({path:path.join(root,'tests/test-identity.ts')}))}}]});
const mf=new Miniflare({modules:true,scriptPath:outfile,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};
const api=async(p,method='GET',body,who='operator-a',origin)=>{
 const headers={};if(who)headers['x-test-user']=who;if(origin)headers.origin=origin;
 if(body instanceof FormData){const encoded=new Request('https://wasteops.test',{method:'POST',body});headers['content-type']=encoded.headers.get('content-type');body=await encoded.arrayBuffer();}else if(body){headers['content-type']='application/json';body=JSON.stringify(body);}
 const res=await mf.dispatchFetch(`https://wasteops.test/api/${p}`,{method,headers,...(body?{body}:{})});
 const data=res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text();
 if(res.status>=500)console.error('Server failure',p,data);return {status:res.status,data};
};
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort()){
  const sql=await readFile(path.join('drizzle',file),'utf8');
  for(const stmt of sql.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(stmt).run();
 }
 eq((await api('incidents','GET',null,null)).status,401);
 const form=new FormData();form.set('photo',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=','base64')],'test.png',{type:'image/png'}));
 const up=await api('uploads','POST',form);eq(up.status,200);const key=up.data.key;
 eq((await api(`media/${key}`,'GET',null,'operator-b')).status,404);
 const id=crypto.randomUUID();const body={submissionId:id,lat:51.51,lng:-.31,address:'Test incident — Ealing pilot simulation',note:'Automated test only',photoKey:key};
 eq((await api('incidents','POST',body,'operator-a','https://elsewhere.test')).status,403);
 const create=await api('incidents','POST',body);eq(create.status,201);
 eq((await api('incidents','POST',body)).data.incident.id,id);
 eq((await api('incidents')).data.incidents.length,1);
 eq((await api('work-orders','POST',{incidentId:id,action:'assign',crew:'Vehicle Crew 1'})).status,409);
 eq((await api('incidents','PATCH',{id,status:'Resolved'})).status,409);
 eq((await api('work-orders','POST',{incidentId:id,action:'authorise',authority:'Test pilot simulation'},'operator-b')).status,404);
 const authorise=await api('work-orders','POST',{incidentId:id,action:'authorise',authority:'Test pilot simulation'});eq(authorise.status,200);eq(authorise.data.incident.job.status,'Authorised');
 eq((await api('work-orders','POST',{incidentId:id,action:'authorise',authority:'Test pilot simulation'})).data.incident.job.id,authorise.data.incident.job.id);
 eq((await api('work-orders','POST',{incidentId:id,action:'assign',crew:'Street Crew 3'})).status,400);
 const assign=await api('work-orders','POST',{incidentId:id,action:'assign',crew:'Vehicle Crew 1'});eq(assign.status,200);eq(assign.data.incident.status,'Assigned');
 const plan={crew:'Vehicle Crew 1',day:'2026-11-05',stops:[id]};
 eq((await api('routes','POST',{...plan,stops:['demo-1']})).status,409);
 eq((await api('routes','POST',plan)).status,200);
 eq((await api('routes')).data.plans[0].stops,[id]);
 eq((await api('routes','GET',null,'operator-b')).data.plans.length,0);
 eq((await api('work-orders','POST',{incidentId:id,action:'advance',status:'Accepted'})).status,409);
 for(const status of ['Travelling','Arrived','Working'])eq((await api('work-orders','POST',{incidentId:id,action:'advance',status})).status,200);
	const finished=await api('work-orders','POST',{incidentId:id,action:'advance',status:'Completed'});eq(finished.status,200);eq(finished.data.incident.job.status,'Completed');
 eq((await api('incidents','PATCH',{id,afterPhotoKey:key})).status,200);
	eq((await api('incidents')).data.incidents[0].job.status,'Evidence submitted');
 eq((await api('work-orders','POST',{incidentId:id,action:'advance',status:'Accepted'})).data.incident.status,'Resolved');
 eq((await api('incidents')).data.incidents[0].job.status,'Accepted');
 eq((await api('routes','POST',plan)).status,409);
 eq((await api('incidents','PATCH',{id,afterPhotoKey:key})).status,409);
 eq((await api('work-orders','POST',{incidentId:id,action:'advance',status:'Disputed'})).data.incident.status,'Reopened');
 // Merge preserves and can restore the observation link.
 const sourceId=crypto.randomUUID(),targetId=crypto.randomUUID();
 eq((await api('incidents','POST',{...body,submissionId:sourceId})).status,201);
 eq((await api('incidents','POST',{...body,submissionId:targetId})).status,201);
 eq((await api('merges','POST',{sourceId,targetId})).status,200);
 eq((await db.prepare('SELECT incident_id FROM observations WHERE id=?').bind(sourceId).first()).incident_id,targetId);
 eq((await api('incidents','PATCH',{id:sourceId,category:'Litter'})).status,409);
 const merge=(await api('merges')).data.merges[0];
 eq((await api('merges','POST',{action:'reverse',id:merge.id},'operator-b')).status,404);
 eq((await api('merges','POST',{action:'reverse',id:merge.id})).status,200);
 eq((await db.prepare('SELECT incident_id FROM observations WHERE id=?').bind(sourceId).first()).incident_id,sourceId);
 eq((await api('merges')).data.merges.length,0);
 // Demo records must never collide across owners.
 for(const who of ['operator-a','operator-b'])eq((await api('work-orders','POST',{incidentId:'demo-3',action:'authorise',authority:'Test pilot simulation'},who)).status,200);
 const bRecords=(await api('incidents','GET',null,'operator-b')).data.incidents;eq(bRecords.length,1);eq(bRecords[0].events.filter(e=>e.text.includes('Work authorised')).length,1);
 console.log(`${checks} assertions passed: reporting, idempotency, private photos, ownership, authorisation, crew capability, route persistence, job transitions, evidence, acceptance, disputes and reversible merges.`);
}finally{await mf.dispose()}
