import {test} from "node:test";
import assert from "node:assert/strict";
import type {AuditEvent,ToolContext,ToolDefinition} from "@yazoni/core";
import {ServerAgent} from "@yazoni/ai";
test("complete prison transformation request plans, pauses, executes, and verifies",async()=>{
 const state={mode:"survival",motd:"A Minecraft Server",validated:false};
 const tools:ToolDefinition[]=[
  {name:"config.read",description:"Read current server configuration.",risk:"safe",input:{},execute:async()=>({...state})},
  {name:"config.set",description:"Set prison server configuration.",risk:"destructive",input:{mode:"string",motd:"string"},execute:async(input,c)=>{assert.equal(c.approved,true);const v=input as {mode:string;motd:string};state.mode=v.mode;state.motd=v.motd;return{ok:true,...state}}},
  {name:"config.validate",description:"Validate server configuration.",risk:"safe",input:{},execute:async()=>{state.validated=state.mode==="adventure"&&state.motd.includes("Prison");return{valid:state.validated}}},
  {name:"server.status",description:"Inspect final server state.",risk:"safe",input:{},execute:async()=>({...state,online:true})}
 ];
 let call=0;
 const model={async generate(input:{system:string;messages:unknown[];tools:unknown[]}){call++;if(call===1)return{toolCalls:[{name:"config.read",arguments:{},callId:"read"}]};if(call===2)return{toolCalls:[{name:"config.set",arguments:{mode:"adventure",motd:"Prison Server"},callId:"set"}]};if(call===3)return{toolCalls:[{name:"config.validate",arguments:{},callId:"validate"}]};if(call===4)return{toolCalls:[{name:"server.status",arguments:{},callId:"status"}]};return{text:"Prison transformation verified."}}};
 const audit:AuditEvent[]=[];const write=(event:AuditEvent)=>{audit.push(event);return Promise.resolve()};
 const operator=new ServerAgent(model,tools,write);const base:ToolContext={requestId:"e2e",actorId:"test",serverId:"test",dryRun:false,approved:false};
 const waiting=await operator.run("Turn this into a prison server and verify everything works.",base,"job-e2e");assert.equal(waiting.job.status,"waiting_approval");assert.equal(state.mode,"survival");
 const complete=await operator.run("Turn this into a prison server and verify everything works.",{...base,approved:true},"job-e2e");
 assert.equal(complete.job.status,"completed");assert.equal(state.mode,"adventure");assert.equal(state.validated,true);assert.match(complete.answer,/verified/i);assert.ok(audit.some(event=>event.tool==="config.set"&&event.outcome==="success"));
});