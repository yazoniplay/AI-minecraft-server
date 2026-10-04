import {NextRequest,NextResponse} from "next/server";

const base=process.env.CONTROL_PLANE_URL?.replace(/\/$/,"");
const token=process.env.CONTROL_ADMIN_TOKEN;
const serverId=process.env.SERVER_ID??"minecraft-server";
async function forward(path:string,init:RequestInit={}){if(!base||!token)throw new Error("Control plane is not configured.");const headers=new Headers(init.headers);headers.set("authorization","Bearer "+token);headers.set("content-type","application/json");const res=await fetch(base+path,{...init,headers,cache:"no-store"});const text=await res.text();return new NextResponse(text,{status:res.status,headers:{"content-type":"application/json"}});}
export async function GET(){return forward("/v1/state");}
export async function POST(req:NextRequest){
 const body=await req.json() as Record<string,unknown>;
 if(body.action==="approve"){const jobId=String(body.jobId??"");if(!/^[a-zA-Z0-9_-]{8,100}$/.test(jobId))return NextResponse.json({error:"Invalid job id."},{status:400});return forward("/v1/jobs/"+encodeURIComponent(jobId)+"/approve",{method:"POST",body:"{}"});}
 if(body.action==="job"){const goal=String(body.goal??"").trim();return forward("/v1/jobs",{method:"POST",body:JSON.stringify({goal,serverId})});}
 return NextResponse.json({error:"Unknown action."},{status:400});
}