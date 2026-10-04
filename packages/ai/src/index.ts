import type {AuditEvent,Job,ToolContext,ToolDefinition} from "@yazoni/core";
import type {AgentMessage} from "./openai-compatible.js";
import {GeminiFlashLiteProvider} from "./gemini.js";

export type {AgentMessage} from "./openai-compatible.js";

export interface ModelProvider {
  generate(input:{system:string;messages:AgentMessage[];tools:unknown[]}):Promise<{text?:string;toolCalls?:Array<{name:string;arguments:unknown;callId:string;thoughtSignature?:string}>}>;
}

export class ServerAgent {
  constructor(private model:ModelProvider,private tools:ToolDefinition[],private audit:(event:AuditEvent)=>Promise<void>){}

  async run(goal:string,context:ToolContext,jobId?:string):Promise<{job:Job;answer:string}> {
    const job:Job={id:jobId??crypto.randomUUID(),serverId:context.serverId,status:"planning",goal,steps:[]};
    const toolMap=new Map(this.tools.map(tool=>[tool.name,tool]));
    const messages:AgentMessage[]=[{role:"user",content:goal}];

    for(let round=0;round<32;round++){
      job.status="running";
      const response=await this.model.generate({
        system:"You are Yazoni Server AI, an expert Minecraft server operator. Inspect before changing things. Prefer reversible operations, respect risk and approval, verify important changes, and never claim success without tool evidence. If approval is missing, explain exactly which operation needs approval. For infrastructure transformations, make a plan, execute it, then verify the final state.",
        messages,
        tools:this.tools.map(tool=>({name:tool.name,description:tool.description+" Risk: "+tool.risk+".",risk:tool.risk,input:tool.input}))
      });
      if(!response.toolCalls?.length){job.status="completed";return{job,answer:response.text??"Completed."};}
      messages.push({role:"assistant",content:response.text??"",toolCalls:response.toolCalls});

      let waitingForApproval=false;
      for(const call of response.toolCalls){
        const tool=toolMap.get(call.name);
        if(!tool){messages.push({role:"tool",toolCallId:call.callId,name:call.name,content:JSON.stringify({error:"Unknown tool"})});continue;}
        job.steps.push({id:call.callId,tool:call.name,status:"running"});
        const step=job.steps.find(item=>item.id===call.callId);
        if(context.dryRun&&tool.risk!=="safe"){if(step)step.status="dry-run";messages.push({role:"tool",toolCallId:call.callId,name:call.name,content:JSON.stringify({dryRun:true,wouldExecute:true,risk:tool.risk,approvalRequired:true})});continue;}
        if(tool.risk!=="safe"&&!context.approved){if(step)step.status="waiting_approval";job.status="waiting_approval";waitingForApproval=true;messages.push({role:"tool",toolCallId:call.callId,name:call.name,content:JSON.stringify({error:"Approval required before this action can execute.",risk:tool.risk,plannedArguments:call.arguments})});continue;}
        try{
          const result=await tool.execute(call.arguments,context);
          if(step)step.status="completed";
          await this.audit({id:crypto.randomUUID(),timestamp:new Date().toISOString(),actorId:context.actorId,serverId:context.serverId,tool:call.name,risk:tool.risk,input:call.arguments,outcome:"success"});
          messages.push({role:"tool",toolCallId:call.callId,name:call.name,content:JSON.stringify(result)});
        }catch(error){
          const message=error instanceof Error?error.message:String(error);
          if(step)step.status="failed";
          await this.audit({id:crypto.randomUUID(),timestamp:new Date().toISOString(),actorId:context.actorId,serverId:context.serverId,tool:call.name,risk:tool.risk,input:call.arguments,outcome:"failure",error:message});
          messages.push({role:"tool",toolCallId:call.callId,name:call.name,content:JSON.stringify({error:message})});
        }
      }
      if(waitingForApproval)return{job,answer:"Some planned actions need your approval before the agent can continue."};
    }
    job.status="failed";
    throw new Error("Maximum tool rounds exceeded.");
  }
}

export {GeminiFlashLiteProvider};
export {OpenAICompatibleProvider,toolsForModel} from "./openai-compatible.js";