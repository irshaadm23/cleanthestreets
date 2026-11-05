// Isolated harness: never imported by the production Worker.
import * as incidents from '../app/api/incidents/route';
import * as uploads from '../app/api/uploads/route';
import * as media from '../app/api/media/[id]/route';
import * as jobs from '../app/api/work-orders/route';
import * as routes from '../app/api/routes/route';
import * as merges from '../app/api/merges/route';
import {setUser} from './test-identity';
export default {async fetch(request:Request){
 setUser(request.headers.get('x-test-user'));
 const path=new URL(request.url).pathname;
 if(path.startsWith('/api/media/'))return media.GET(request,{params:Promise.resolve({id:path.split('/').pop()!})});
 const endpoints:Record<string,unknown>={'/api/incidents':incidents,'/api/uploads':uploads,'/api/work-orders':jobs,'/api/routes':routes,'/api/merges':merges};
 const handler=(endpoints[path] as Record<string,Function>)?.[request.method];
 return handler?handler(request):new Response('Not found',{status:404});
}};
