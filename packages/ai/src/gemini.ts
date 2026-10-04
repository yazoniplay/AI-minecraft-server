import type {ToolDefinition} from "@yazoni/core";
import type {AgentMessage,ModelProvider} from "./index.js";

type GeminiPart={text?:string;functionCall?:{name:string;args?:Record<string,unknown>};functionResponse?:{name:string;response:unknown};thoughtSignature?:string};
type GeminiContent={role:"user"|"model";parts:GeminiPart[]};

function schema(input:unknown):Record<string,unknown>{
 if(!input||typeof input!=="object"||Array.isArray(input))return{type:"OBJECT",properties:{},additionalProperties:false};
 const properties:Record<string,unknown>={};const required:string[]=[];
 for(const [key,raw] of Object.entries(input as Record<string,unknown>)){
  const spec=String(raw);const optional=spec.endsWith("?");const core=optional?spec.slice(0,-1):spec;
  if(core.includes("|"))properties[key]={type:"STRING",enum:core.split("|")};
  else if(core==="number")properties[key]={type:"NUMBER"};
  else if(core==="boolean")properties[key]={type:"BOOLEAN"};
  else properties[key]={type:"STRING"};
  if(!optional)required.push(key);
 }
 return{type:"OBJECT",properties,required};
}

function convertMessages(messages:AgentMessage[]):GeminiContent[]{
 const result:GeminiContent[]=[];
 for(const message of messages){
  if(message.role==="user")result.push({role:"user",parts:[{text:message.content}]});
  else if(message.role==="assistant"){
   const parts:GeminiPart[]=[];if(message.content)parts.push({text:message.content});
   for(const call of message.toolCalls??[])parts.push({functionCall:{name:call.name,args:(call.arguments??{}) as Record<string,unknown>},...(call.thoughtSignature?{thoughtSignature:call.thoughtSignature}:{})});
   result.push({role:"model",parts});
  }else{
   result.push({role:"user",parts:[{functionResponse:{name:message.name??"tool",response:JSON.parse(message.content||"{}")}}]});
  }
 }
 return result;
}

export class GeminiFlashLiteProvider implements ModelProvider{
 readonly model:string;
 constructor(private readonly options:{apiKey:string;model?:string}){
  if(!options.apiKey)throw new Error("GEMINI_API_KEY is required.");
  this.model=options.model??"gemini-3.5-flash-lite";
 }
 async generate(input:{system:string;messages:AgentMessage[];tools:unknown[]}):Promise<{text?:string;toolCalls?:Array<{name:string;arguments:unknown;callId:string}>}>{
  const declared=input.tools as Array<{name:string;description:string;input:unknown}>;
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(this.model)+":generateContent?key="+encodeURIComponent(this.options.apiKey),{
   method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({systemInstruction:{parts:[{text:input.system}]},contents:convertMessages(input.messages),tools:[{functionDeclarations:declared.map(tool=>({name:tool.name,description:tool.description,parametersJsonSchema:schema(tool.input)}))}],toolConfig:{functionCallingConfig:{mode:"AUTO"}},generationConfig:{temperature:0.15}}),
   signal:AbortSignal.timeout(90000)
  });
  if(!response.ok)throw new Error("Gemini request failed ("+response.status+"): "+(await response.text()).slice(0,1200));
  const data=await response.json() as {candidates?:Array<{content?:{parts?:GeminiPart[]}}>} ;
  const parts=data.candidates?.[0]?.content?.parts??[];
  const text=parts.filter(part=>part.text).map(part=>part.text).join("\n").trim();
  const toolCalls=parts.filter(part=>part.functionCall).map((part,index)=>({name:part.functionCall!.name,arguments:part.functionCall!.args??{},callId:"gemini-"+Date.now()+"-"+index,...(part.thoughtSignature?{thoughtSignature:part.thoughtSignature}:{})}));
  return{...(text?{text}:{}),...(toolCalls.length?{toolCalls}:{})};
 }
}
