import {createServer} from "node:http";
import {randomBytes} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";
import type {Job,ServerStatus} from "@yazoni/core";

type Agent={serverId:string;token:string;connectedAt:string;lastSeen:string};
type Command={id:string;type:"run";jobId:string;goal:string;approved:boolean};
type StoredJob=Job & {approved:boolean;answer?:string};
type State={pairingConsumed?:boolean;agents:Record<string,Agent>;jobs:Record<string,StoredJob>;commands:Record<string,Command[]>;events:Array<{id:string;timestamp:string;serverId:string;type:string;data:unknown}>;status:Record<string,ServerStatus>;console:Record<string,string[]>};

const port=Number(process.env.PORT??8787);
const adminToken=process.env.CONTROL_ADMIN_TOKEN;
const pairingCode=process.env.PAIRING_CODE;
if(!adminToken||!pairingCode)throw new Error("CONTROL_ADMIN_TOKEN and PAIRING_CODE are required.");

const dataFile=path.resolve(process.env.CONTROL_STATE_FILE??"./control-state.json");
const initial:State={pairingConsumed:false,agents:{},jobs:{},commands:{},events:[],status:{},console:{}};
let state:State=initial;
try{state=JSON.parse(await fs.readFile(dataFile,"utf8")) as State;}catch{}
const save=async()=>{await fs.mkdir(path.dirname(dataFile),{recursive:true});await fs.writeFile(dataFile,JSON.stringify(state,null,2));};
const json=(res:any,status:number,value:unknown)=>{res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"});res.end(JSON.stringify(value));};
const body=async(req:any)=>{let raw="";for await(const chunk of req)raw+=chunk;return raw?JSON.parse(raw):{};};
const auth=(req:any,token:string)=>req.headers.authorization==="Bearer "+token;
const admin=(req:any)=>auth(req,adminToken);
const agentFor=(req:any,serverId:string)=>state.agents[serverId]&&auth(req,state.agents[serverId].token);
const event=async(serverId:string,type:string,data:unknown)=>{state.events.push({id:randomBytes(12).toString("hex"),timestamp:new Date().toISOString(),serverId,type,data});if(state.events.length>1000)state.events.splice(0,state.events.length-1000);await save();};

const server=createServer(async(req,res)=>{
 if(req.method==="OPTIONS"){res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"GET,POST,OPTIONS"});return res.end();}
 const url=new URL(req.url??"/","http://localhost");
 try{
  if(url.pathname==="/health"){return json(res,200,{ok:true,agents:Object.keys(state.agents).length});}
  if(url.pathname==="/v1/agents/pair"&&req.method==="POST"){
   const b=await body(req);
   if(state.pairingConsumed)return json(res,409,{error:"Pairing code has already been consumed. Generate a new pairing code on the control plane before pairing another agent."});
   if(b.pairingCode!==pairingCode)return json(res,401,{error:"Invalid pairing code."});
   const serverId=String(b.serverId??"").trim();
   if(!/^[a-zA-Z0-9._-]{1,80}$/.test(serverId))return json(res,400,{error:"Invalid serverId."});
   const token=randomBytes(32).toString("hex");const now=new Date().toISOString();
   state.agents[serverId]={serverId,token,connectedAt:now,lastSeen:now};state.pairingConsumed=true;state.commands[serverId]??=[];state.console[serverId]??=[];
   await save();await event(serverId,"agent.paired",{serverId});
   return json(res,200,{serverId,token});
  }
  const serverId=url.searchParams.get("serverId")??"";
  if(url.pathname==="/v1/agents/commands"&&req.method==="GET"){
   if(!serverId||!agentFor(req,serverId))return json(res,401,{error:"Unauthorized"});
   const agent=state.agents[serverId];
   if(!agent)return json(res,401,{error:"Unauthorized"});
   agent.lastSeen=new Date().toISOString();await save();
   return json(res,200,{commands:state.commands[serverId]??[]});
  }
  if(url.pathname==="/v1/agents/ack"&&req.method==="POST"){
   const b=await body(req);const sid=String(b.serverId??"");
   if(!sid||!agentFor(req,sid))return json(res,401,{error:"Unauthorized"});
   const agent=state.agents[sid];
   if(!agent)return json(res,401,{error:"Unauthorized"});
   state.commands[sid]=(state.commands[sid]??[]).filter(c=>c.id!==String(b.commandId));agent.lastSeen=new Date().toISOString();await save();
   return json(res,200,{ok:true});
  }
  if(url.pathname==="/v1/agents/events"&&req.method==="POST"){
   const b=await body(req);const sid=String(b.serverId??"");
   if(!sid||!agentFor(req,sid))return json(res,401,{error:"Unauthorized"});
   const agent=state.agents[sid];
   if(!agent)return json(res,401,{error:"Unauthorized"});
   agent.lastSeen=new Date().toISOString();
   if(b.type==="status")state.status[sid]=b.data as ServerStatus;
   if(b.type==="console"){const lines=Array.isArray(b.data?.lines)?b.data.lines.map(String):[];state.console[sid]=[...(state.console[sid]??[]),...lines].slice(-500);}
   if(b.type==="job") {
    const j=b.data as Job & {approved?:boolean;answer?:string};
    const stored:StoredJob={...j,approved:j.approved??false};
    if(state.jobs[j.id])state.jobs[j.id]={...state.jobs[j.id],...stored};
    else state.jobs[j.id]=stored;
   }
   await event(sid,String(b.type??"event"),b.data);await save();return json(res,200,{ok:true});
  }
  if(!admin(req))return json(res,401,{error:"Unauthorized"});
  if(url.pathname==="/v1/state"&&req.method==="GET"){
   const pending=Object.values(state.jobs).filter(j=>j.status==="waiting_approval");
   return json(res,200,{agents:Object.values(state.agents).map(a=>({...a,token:undefined})),jobs:Object.values(state.jobs).slice(-50),pending,status:state.status,console:state.console});
  }
  if(url.pathname==="/v1/jobs"&&req.method==="POST"){
   const b=await body(req);const goal=String(b.goal??"").trim();const sid=String(b.serverId??"");
   if(!goal||goal.length>8000)return json(res,400,{error:"Goal must be 1-8000 characters."});
   if(!state.agents[sid])return json(res,409,{error:"Agent is not paired."});
   const job:StoredJob={id:randomBytes(16).toString("hex"),serverId:sid,status:"queued",goal,steps:[],approved:false};
   state.jobs[job.id]=job;state.commands[sid]??=[];state.commands[sid].push({id:randomBytes(12).toString("hex"),type:"run",jobId:job.id,goal,approved:false});
   await save();await event(sid,"job.created",job);return json(res,202,{job});
  }
  const approval=url.pathname.match(/^\/v1\/jobs\/([^/]+)\/approve$/);
  if(approval&&req.method==="POST"){
   const jobId=approval[1];
   if(!jobId)return json(res,400,{error:"Invalid job id."});
   const job=state.jobs[jobId];if(!job)return json(res,404,{error:"Job not found."});
   if(job.status!=="waiting_approval")return json(res,409,{error:"Job is not waiting for approval."});
   job.approved=true;job.status="queued";state.commands[job.serverId]??=[];state.commands[job.serverId].push({id:randomBytes(12).toString("hex"),type:"run",jobId:job.id,goal:job.goal,approved:true});await save();await event(job.serverId,"job.approved",{jobId:job.id});return json(res,200,{job});
  }
  return json(res,404,{error:"Not found"});
 }catch(error){return json(res,500,{error:error instanceof Error?error.message:String(error)});}
});
server.listen(port,()=>console.log("Yazoni control plane listening on :"+port));