import {NextRequest,NextResponse} from "next/server";
import SftpClient from "ssh2-sftp-client";
type Install={source:"Modrinth"|"Spigot";id:string;versionId?:string};
function clean(name:string){return name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,180)||"plugin.jar";}
async function download(url:string){const r=await fetch(url,{headers:{"User-Agent":"YazoniPluginDownloader/1.0"}});if(!r.ok)throw new Error(`Download failed: ${r.status}`);return Buffer.from(await r.arrayBuffer());}
export async function POST(req:NextRequest){
 const password=req.headers.get("x-admin-password")??"";if(!process.env.ADMIN_PASSWORD||password!==process.env.ADMIN_PASSWORD)return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json() as Install;if(!body.id||!["Modrinth","Spigot"].includes(body.source))return NextResponse.json({error:"Invalid plugin."},{status:400});
 let sftp:SftpClient|undefined;
 try{
  let url="",filename="";
  if(body.source==="Modrinth"){
   const endpoint=body.versionId?"https://api.modrinth.com/v2/version/"+encodeURIComponent(body.versionId):"https://api.modrinth.com/v2/project/"+encodeURIComponent(body.id)+"/version?limit=100";
   const versions=body.versionId?[await fetch(endpoint,{headers:{"User-Agent":"YazoniPluginDownloader/1.0"},cache:"no-store"}).then(r=>r.json())]:await fetch(endpoint,{headers:{"User-Agent":"YazoniPluginDownloader/1.0"},cache:"no-store"}).then(r=>r.json());
   const v=versions.find((x:any)=>x.files?.some((f:any)=>f.filename?.endsWith(".jar")) )??versions[0];
   const file=v?.files?.find((f:any)=>f.primary&&f.filename.endsWith(".jar"))??v?.files?.find((f:any)=>f.filename.endsWith(".jar"));
   if(!file)throw new Error("No plugin JAR found for that version.");
   url=file.url;filename=file.filename;
  }else{
   const id=body.versionId&&/^\d+$/.test(body.versionId)?body.versionId:body.id;
   url="https://api.spiget.org/v2/resources/"+encodeURIComponent(id)+"/download";
   const meta=await fetch("https://api.spiget.org/v2/resources/"+encodeURIComponent(id),{headers:{"User-Agent":"YazoniPluginDownloader/1.0"},cache:"no-store"}).then(r=>r.json());
   filename=(meta.name??"plugin")+"-"+(meta.version?.name??"latest")+".jar";
  }
  const data=await download(url);
  const sftpHost=process.env.ETERNALZERO_SFTP_HOST;
  const sftpPort=Number(process.env.ETERNALZERO_SFTP_PORT??2022);
  const sftpUsername=process.env.ETERNALZERO_SFTP_USERNAME;
  const sftpPassword=process.env.ETERNALZERO_SFTP_PASSWORD;
  if(!sftpHost||!sftpUsername||!sftpPassword){
   const missing=[!sftpHost?"ETERNALZERO_SFTP_HOST":null,!sftpUsername?"ETERNALZERO_SFTP_USERNAME":null,!sftpPassword?"ETERNALZERO_SFTP_PASSWORD":null].filter(Boolean).join(", ");
   throw new Error("SFTP configuration missing: "+missing);
  }
  const connection={host:sftpHost,port:sftpPort,username:sftpUsername,password:sftpPassword,readyTimeout:20000};
  let lastError:unknown;
  for(let attempt=1;attempt<=3;attempt++){
   sftp=new SftpClient();
   try{await sftp.connect(connection);break}catch(e){lastError=e;await sftp.end().catch(()=>{});sftp=undefined;if(attempt<3)await new Promise(r=>setTimeout(r,1000*attempt));}
  }
  if(!sftp)throw lastError instanceof Error?lastError:new Error("Could not connect to the SFTP server.");
  const root=process.env.ETERNALZERO_SFTP_ROOT??".";
  const dir=root.replace(/\/$/,"")+"/plugins";
  if(!(await sftp.exists(dir)))await sftp.mkdir(dir,true);
  const remote=dir+"/"+clean(filename);
  await sftp.put(data,remote);
  return NextResponse.json({ok:true,filename:clean(filename),source:body.source,size:data.length});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Install failed"},{status:500});}
 finally{await sftp?.end().catch(()=>{});}
}