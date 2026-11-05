export type JobState = "Authorised"|"Assigned"|"Travelling"|"Arrived"|"Working"|"Completed"|"Evidence submitted"|"Accepted"|"Disputed";
export type Priority = "Urgent"|"High"|"Standard"|"Low";
export type HazardConcern = "yes"|"unsure"|"no";
export type WorkOrder = {id:string;incidentId:string;authority:string;status:JobState;crew:string;authorisedAt:string;updatedAt:string;events:{text:string;at:string}[]};
export type RoutePlan = {id:string;crew:string;day:string;stops:string[];approvedAt:string};
export type Incident = {job?:WorkOrder;mergedInto?:string;id:string;reference:string;category:string;status:string;priority?:Priority;hazardConcern?:HazardConcern;address:string;lat:number;lng:number;note:string;photo:string;afterPhoto?:string;crew:string;createdAt:string;events:{text:string;at:string}[];demo:boolean;token?:string;confirmed?:boolean};
export const categories=['Litter','Fly-tipping','Overflowing bin','Street cleaning','Hazardous material','Other'];
export const priorities:Priority[]=['Urgent','High','Standard','Low'];
export function isPotentiallyHazardous(category:string,hazardConcern?:HazardConcern){return category==='Hazardous material'||hazardConcern==='yes'||hazardConcern==='unsure'}
export function priorityFor(category:string,hazardConcern?:HazardConcern):Priority{
 if(isPotentiallyHazardous(category,hazardConcern))return 'Urgent';
 if(category==='Fly-tipping')return 'High';
 if(category==='Litter'||category==='Street cleaning')return 'Low';
 return 'Standard';
}
export const statuses=['Reported','Under review','Assigned','In progress','Resolved','Reopened'];
export const crews=[{name:'Vehicle Crew 1',mode:'Vehicle',area:'Ealing & Hanwell',capabilities:['Fly-tipping','Overflowing bin','Other'],people:3},{name:'Street Crew 2',mode:'On foot',area:'Greenford',capabilities:['Litter','Street cleaning','Overflowing bin'],people:2},{name:'Street Crew 3',mode:'On foot',area:'Acton',capabilities:['Litter','Street cleaning'],people:2},{name:'Specialist Response Crew (demo)',mode:'Specialist vehicle',area:'Ealing & Hanwell',capabilities:['Hazardous material','Fly-tipping'],people:3}];
const rows:[string,string,string,number,number,string][]=[
 ['Fly-tipping','In progress',"St. Mary’s Road, Ealing",51.5087,-.3053,'Vehicle Crew 1'],
 ['Overflowing bin','Assigned','Greenford Avenue, Hanwell',51.5203,-.3326,'Street Crew 2'],
 ['Litter','Reported','Uxbridge Road, Ealing',51.5134,-.3021,''],
 ['Fly-tipping','Resolved','Perivale Lane, Perivale',51.5355,-.3248,'Vehicle Crew 1'],
 ['Street cleaning','Under review','Northolt Road, Northolt',51.5471,-.3704,''],
 ['Litter','Assigned','The Broadway, Greenford',51.5290,-.3533,'Street Crew 2'],
 ['Overflowing bin','Reported','Walpole Park, Ealing',51.5088,-.3125,''],
 ['Street cleaning','Resolved','Churchfield Road, Acton',51.5079,-.2667,'Street Crew 3'],
 ['Fly-tipping','Under review','Ruislip Road, Greenford',51.5359,-.3591,''],
 ['Litter','Resolved','Pitshanger Lane, Ealing',51.5292,-.3117,'Street Crew 2'],
 ['Overflowing bin','Resolved','South Ealing Road, Ealing',51.5005,-.3068,'Vehicle Crew 1'],
 ['Street cleaning','In progress','High Street, Acton',51.5065,-.2719,'Street Crew 3'],
 ['Hazardous material','Under review','Station Parade, Acton',51.5085,-.2684,'']
];
export const demoIncidents:Incident[]=rows.map((r,i)=>({id:`demo-${i+1}`,reference:`WO-2026-${87342-i}`,category:r[0],status:r[1],priority:priorityFor(r[0],r[0]==='Hazardous material'?'unsure':undefined),hazardConcern:r[0]==='Hazardous material'?'unsure':undefined,address:r[2],lat:r[3],lng:r[4],crew:r[5],note:r[0]==='Hazardous material'?'Illustrative example: container with unknown contents. Keep clear while a specialist assesses it.':i===0?'Several bags and cardboard beside the railings. Please keep the footpath clear.':'Illustrative incident for the Ealing demonstration.',photo:'/street-scene.png',createdAt:new Date(Date.UTC(2026,9,26-i%6,10-i%5,24)).toISOString(),events:[{text:'Report received',at:new Date(Date.UTC(2026,9,26-i%6,10-i%5,24)).toISOString()},...(r[1]!=='Reported'?[{text:r[1]==='Resolved'?'Clearance confirmed (demo)':`Status updated to ${r[1].toLowerCase()} (demo)`,at:new Date(Date.UTC(2026,9,26-i%6,12,15)).toISOString()}]:[])],demo:true}));
