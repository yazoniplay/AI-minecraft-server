import {createServer, type IncomingMessage, type ServerResponse} from "node:http";
import {timingSafeEqual} from "node:crypto";
import type {ToolContext,ToolDefinition} from "@yazoni/core";

function send(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(data));}
function authorized(req:IncomingMessage,token:string){const header=req.headers.authorization??"";const supplied=header.startsWith("Bearer ")?header.slice(7):"";const a=Buffer.from(supplied);const b=Buffer.from(token);return a.length===b.length&&timingSafeEqual(a,b);}
async function body(req:IncomingMessage):Promise<unknown>{let raw="";for await(const chunk of req){raw+=chunk.toString();if(raw.length>1_000_000)throw new Error("Request body too large.");}return raw?JSON.parse(raw):{};}

export function startLocalApi(options:{token:string;serverId:string;tools:ToolDefinition[];port?:number}){
 if(options.token.length<32)throw new Error("YAZONI_AGENT_TOKEN must be at least 32 characters.");
 const byName=new Map(options.tools.map(tool=>[tool.name,tool]));
 const server=createServer(async(req,res)=>{
  try{
   if(req.url==="/health"&&req.method==="GET"){send(res,200,{ok:true,serverId:options.serverId,mode:"loopback"});return;}
   if(!authorized(req,options.token)){send(res,401,{error:"Unauthorized"});return;}
   if(req.url==="/tools"&&req.method==="GET"){send(res,200,{serverId:options.serverId,tools:options.tools.map(tool=>({name:tool.name,description:tool.description,risk:tool.risk,input:tool.input}))});return;}
   if(req.url==="/execute"&&req.method==="POST"){
    const value=await body(req) as {id?:unknown;tool?:unknown;input?:unknown;actorId?:unknown;approved?:unknown;dryRun?:unknown};
    const id=typeof value.id==="string"?value.id:"";const name=typeof value.tool==="string"?value.tool:"";const tool=byName.get(name);
    if(!id||!tool){send(res,400,{error:"A request id and registered tool name are required."});return;}
    const approved=value.approved===true&&process.env.YAZONI_ALLOW_MUTATIONS==="true";
    if(value.approved===true&&!approved){send(res,403,{error:"Mutations are disabled. Set YAZONI_ALLOW_MUTATIONS=true and require an explicit UI approval first."});return;}
    const context:ToolContext={requestId:id,actorId:typeof value.actorId==="string"?value.actorId:"local-control-plane",serverId:options.serverId,dryRun:value.dryRun===true,approved};
    try{const result=await tool.execute(value.input,context);send(res,200,{id,ok:true,result});}catch(error){send(res,400,{id,ok:false,error:error instanceof Error?error.message:String(error)});}return;
   }
   send(res,404,{error:"Not found"});
  }catch(error){send(res,400,{error:error instanceof Error?error.message:"Invalid request"});}
 });
 const port=options.port??7331;
 server.listen(port,"127.0.0.1",()=>console.log("Local agent API listening on http://127.0.0.1:"+port));
 return server;
}