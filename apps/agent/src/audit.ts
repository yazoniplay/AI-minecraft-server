import {appendFile,mkdir} from "node:fs/promises";
import path from "node:path";
import type {AuditEvent,ToolContext,ToolDefinition} from "@yazoni/core";

function redact(value:unknown,key=""):unknown {
  if(/password|token|secret|api.?key|content|authorization/i.test(key))return "[REDACTED]";
  if(Array.isArray(value))return value.map(item=>redact(item));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,redact(v,k)]));
  if(typeof value==="string"&&value.length>400)return value.slice(0,400)+"…[truncated]";
  return value;
}

export class AuditLogger {
  private readonly file:string;
  constructor(serverRoot:string){this.file=path.resolve(serverRoot,"..","."+path.basename(serverRoot)+"-yazoni-audit","events.jsonl");}
  async write(event:AuditEvent):Promise<void>{
    await mkdir(path.dirname(this.file),{recursive:true});
    await appendFile(this.file,JSON.stringify({...event,input:redact(event.input)})+"\n",{encoding:"utf8",mode:0o600});
  }
  wrap(tools:ToolDefinition[]):ToolDefinition[]{
    return tools.map(tool=>({...tool,execute:async(input:unknown,context:ToolContext)=>{
      const base={id:crypto.randomUUID(),timestamp:new Date().toISOString(),actorId:context.actorId,serverId:context.serverId,tool:tool.name,risk:tool.risk,input};
      try{
        const result=await tool.execute(input,context);
        await this.write({...base,outcome:context.dryRun?"dry-run":"success"});
        return result;
      }catch(error){
        const message=error instanceof Error?error.message:String(error);
        await this.write({...base,outcome:"failure",error:message});
        throw error;
      }
    }}));
  }
}
