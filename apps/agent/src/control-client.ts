import {promises as fs} from "node:fs";
import path from "node:path";
import type {Job,ServerStatus} from "@yazoni/core";

type Command={id:string;type:"run";jobId:string;goal:string;approved:boolean};
type EventPayload={serverId:string;type:"status"|"console"|"job";data:unknown};

export class ControlClient{
 private token:string|undefined;
 private readonly serverId:string;
 private readonly base:string;
 private readonly tokenFile:string;
 private readonly pairingCode:string|undefined;
 private reauthenticating=false;

 constructor(options:{baseUrl:string;serverId:string;pairingCode?:string|undefined;root:string}){
  this.base=options.baseUrl.replace(/\/$/,"");this.serverId=options.serverId;this.tokenFile=path.join(options.root,".yazoni-agent-token");
  this.pairingCode=options.pairingCode;
 }

 private async pair(){
  if(!this.pairingCode)throw new Error("Agent is not paired. Set PAIRING_CODE for the first connection.");
  const res=await fetch(this.base+"/v1/agents/pair",{
   method:"POST",
   headers:{"content-type":"application/json"},
   body:JSON.stringify({serverId:this.serverId,pairingCode:this.pairingCode}),
   signal:AbortSignal.timeout(15000)
  });
  if(!res.ok)throw new Error("Control plane pairing "+res.status+": "+(await res.text()).slice(0,500));
  const result=await res.json() as {token?:unknown};
  if(typeof result.token!=="string"||!result.token)throw new Error("Control plane pairing returned no agent token.");
  this.token=result.token;
  await fs.mkdir(path.dirname(this.tokenFile),{recursive:true});
  await fs.writeFile(this.tokenFile,this.token,{mode:0o600});
 }

 private async request(pathname:string,init:RequestInit={},allowReauth=true):Promise<any>{
  const headers=new Headers(init.headers);headers.set("content-type","application/json");
  if(this.token)headers.set("authorization","Bearer "+this.token);
  const res=await fetch(this.base+pathname,{...init,headers,signal:AbortSignal.timeout(15000)});
  if(res.status===401&&allowReauth&&pathname!=="/v1/agents/pair"&&this.pairingCode&&!this.reauthenticating){
   this.reauthenticating=true;
   try{
    this.token=undefined;
    await this.pair();
    return await this.request(pathname,init,false);
   }finally{this.reauthenticating=false;}
  }
  if(!res.ok)throw new Error("Control plane "+res.status+": "+(await res.text()).slice(0,500));
  return res.json() as Promise<any>;
 }

 async connect(){
  try{
   this.token=(await fs.readFile(this.tokenFile,"utf8")).trim();
   await this.request("/v1/agents/commands?serverId="+encodeURIComponent(this.serverId));
   return;
  }catch{
   this.token=undefined;
  }
  await this.pair();
 }

 async commands():Promise<Command[]>{return (await this.request("/v1/agents/commands?serverId="+encodeURIComponent(this.serverId))).commands??[];}
 async ack(commandId:string){await this.request("/v1/agents/ack",{method:"POST",body:JSON.stringify({serverId:this.serverId,commandId})});}
 async emit(type:EventPayload["type"],data:unknown){await this.request("/v1/agents/events",{method:"POST",body:JSON.stringify({serverId:this.serverId,type,data})});}
 async heartbeat(status:ServerStatus,consoleLines:string[]){await this.emit("status",status);if(consoleLines.length)await this.emit("console",{lines:consoleLines});}
}
