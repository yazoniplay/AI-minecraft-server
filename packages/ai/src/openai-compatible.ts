import type {ToolDefinition} from "@yazoni/core";

export type AgentMessage={role:"user"|"assistant"|"tool";content:string;toolCallId?:string;name?:string;toolCalls?:Array<{name:string;arguments:unknown;callId:string}>};

function inputSchema(input:unknown):Record<string,unknown>{
 if(!input||typeof input!=="object"||Array.isArray(input))return{type:"object",properties:{},additionalProperties:false};
 const properties:Record<string,unknown>={};const required:string[]=[];
 for(const [key,raw] of Object.entries(input as Record<string,unknown>)){
  const spec=String(raw);const optional=spec.endsWith("?");const core=optional?spec.slice(0,-1):spec;
  if(core.includes("|"))properties[key]={type:"string",enum:core.split("|")};
  else if(core==="number")properties[key]={type:"number"};
  else if(core==="boolean")properties[key]={type:"boolean"};
  else properties[key]={type:"string"};
  if(!optional)required.push(key);
 }
 return{type:"object",properties,required,additionalProperties:false};
}

export class OpenAICompatibleProvider {
 constructor(private readonly options:{apiKey:string;baseUrl?:string;model:string}){if(!options.apiKey)throw new Error("AI API key is required.");if(!options.model)throw new Error("AI model name is required.");}
 async generate(input:{system:string;messages:AgentMessage[];tools:unknown[]}):Promise<{text?:string;toolCalls?:Array<{name:string;arguments:unknown;callId:string}>}>{
  const tools=input.tools as Array<{name:string;description:string;input:unknown}>;
  const messages=[{role:"system",content:input.system},...input.messages.map(message=>{
   if(message.role==="assistant"&&message.toolCalls?.length)return{role:"assistant",content:message.content||null,tool_calls:message.toolCalls.map(call=>({id:call.callId,type:"function",function:{name:call.name,arguments:JSON.stringify(call.arguments)}}))};
   if(message.role==="tool")return{role:"tool",tool_call_id:message.toolCallId??"unknown",name:message.name??"unknown",content:message.content};
   return{role:message.role,content:message.content};
  })];
  const configured=this.options.baseUrl??"https://api.openai.com/v1";const base=configured.endsWith("/")?configured.slice(0,-1):configured;
  const response=await fetch(base+"/chat/completions",{method:"POST",headers:{"authorization":"Bearer "+this.options.apiKey,"content-type":"application/json"},body:JSON.stringify({model:this.options.model,messages,tools:tools.map(tool=>({type:"function",function:{name:tool.name,description:tool.description,parameters:inputSchema(tool.input)}})),tool_choice:"auto"}),signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error("AI provider request failed ("+response.status+"): "+(await response.text()).slice(0,1000));
  const data=await response.json() as {choices?:Array<{message?:{content?:string|null;tool_calls?:Array<{id:string;function:{name:string;arguments:string}}>}}>};
  const message=data.choices?.[0]?.message;if(!message)throw new Error("AI provider returned no message.");
  const toolCalls=(message.tool_calls??[]).map(call=>{let args:unknown={};try{args=JSON.parse(call.function.arguments);}catch{throw new Error("AI returned invalid JSON arguments for "+call.function.name);}return{name:call.function.name,arguments:args,callId:call.id};});
  return{...(message.content?{text:message.content}:{}),...(toolCalls.length?{toolCalls}:{})};
 }
}

export function toolsForModel(tools:ToolDefinition[]):Array<{name:string;description:string;risk:string;input:unknown}>{return tools.map(tool=>({name:tool.name,description:tool.description+" Risk: "+tool.risk+".",risk:tool.risk,input:tool.input}));}