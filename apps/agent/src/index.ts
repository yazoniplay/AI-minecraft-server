import {createServerTools} from "@yazoni/tools";
import {createManagementTools} from "./management-tools.js";
import {createConfigurationTools} from "./configuration-tools.js";
import {MinecraftRuntime} from "./server-runtime.js";
import {EternalZeroRuntime} from "./eternalzero-runtime.js";
import {AuditLogger} from "./audit.js";
import {ControlClient} from "./control-client.js";
import {ServerAgent,GeminiFlashLiteProvider} from "@yazoni/ai";
import type {ToolContext} from "@yazoni/core";
import {createServer} from "node:http";

const root=process.env.MINECRAFT_SERVER_DIR??process.env.ETERNALZERO_CACHE_ROOT??"./.yazoni-eternalzero-cache";
if(!root){console.error("Set MINECRAFT_SERVER_DIR.");process.exitCode=1;}
else{
 const port=Number(process.env.PORT??10000);
 const healthServer=createServer((_request,response)=>{response.writeHead(200,{"content-type":"application/json"});response.end(JSON.stringify({ok:true,service:"yazoni-minecraft-agent",runtime:process.env.ETERNALZERO_SFTP_HOST?"eternalzero-sftp":"local"}));});
 healthServer.listen(port,"0.0.0.0",()=>console.log(`Health server listening on 0.0.0.0:${port}`));
 const runtime: MinecraftRuntime|EternalZeroRuntime=process.env.ETERNALZERO_SFTP_HOST
  ? new EternalZeroRuntime({
      host:process.env.ETERNALZERO_SFTP_HOST,
      port:Number(process.env.ETERNALZERO_SFTP_PORT??22),
      username:process.env.ETERNALZERO_SFTP_USERNAME??"",
      ...(process.env.ETERNALZERO_SFTP_PASSWORD?{password:process.env.ETERNALZERO_SFTP_PASSWORD}:{}),
      ...(process.env.ETERNALZERO_SFTP_PRIVATE_KEY?{privateKey:process.env.ETERNALZERO_SFTP_PRIVATE_KEY}:{}),
      root:process.env.ETERNALZERO_SFTP_ROOT??".",
      cacheRoot:process.env.ETERNALZERO_CACHE_ROOT??"./.yazoni-eternalzero-cache"
    })
  : new MinecraftRuntime({root,javaPath:process.env.JAVA_PATH??"java",jarName:process.env.MINECRAFT_SERVER_JAR??"server.jar",maxMemory:process.env.MINECRAFT_MAX_MEMORY??"2G"});
 const audit=new AuditLogger(root);
 const tools=audit.wrap([...createServerTools(runtime),...createManagementTools(runtime),...createConfigurationTools(runtime)]);
 const apiKey=process.env.GEMINI_API_KEY;
 const controlUrl=process.env.CONTROL_PLANE_URL;
 const serverId=process.env.SERVER_ID??"minecraft-server";
 if(!apiKey)throw new Error("GEMINI_API_KEY is required.");
 if(!controlUrl)throw new Error("CONTROL_PLANE_URL is required.");
 const model=new GeminiFlashLiteProvider({apiKey,model:process.env.GEMINI_MODEL??"gemini-3.5-flash-lite"});
 const client=new ControlClient({baseUrl:controlUrl,serverId,pairingCode:process.env.PAIRING_CODE,root});
 const operator=new ServerAgent(model,tools,event=>audit.write(event));
 let consoleCursor=0;const poll=Math.max(500,Number(process.env.AGENT_POLL_MS??1000));
 const sendHeartbeat=async()=>{const lines=runtime.getRecentConsole(200);const fresh=lines.slice(consoleCursor);consoleCursor=lines.length;await client.heartbeat(await runtime.status(),fresh).catch(error=>console.error("heartbeat:",error));};
 const processCommands=async()=>{
  const commands=await client.commands();
  for(const command of commands){
   if(command.type!=="run")continue;
   try{
    const context:ToolContext={requestId:command.jobId,actorId:"web-user",serverId,dryRun:false,approved:command.approved};
    const result=await operator.run(command.goal,context,command.jobId);
    await client.emit("job",result.job);
    await client.emit("job",{...result.job,answer:result.answer});
   }catch(error){
    await client.emit("job",{id:command.jobId,serverId,status:"failed",goal:command.goal,steps:[],answer:error instanceof Error?error.message:String(error)});
   }finally{await client.ack(command.id).catch(error=>console.error("ack:",error));}
  }
 };
 (async()=>{await client.connect();console.log("Paired with control plane as",serverId);console.log("Registered tools:",tools.length);for(const tool of tools)console.log(" -",tool.name,"["+tool.risk+"]");setInterval(()=>sendHeartbeat().catch(()=>{}),poll);setInterval(()=>processCommands().catch(error=>console.error("command loop:",error)),poll);await sendHeartbeat();})().catch(error=>{console.error(error);process.exitCode=1;});
}