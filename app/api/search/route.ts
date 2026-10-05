import {NextRequest,NextResponse} from "next/server";
type Result={id:string;name:string;description:string;icon?:string;downloads?:number;version?:string;source:"Modrinth"|"Spigot";};
async function json(url:string){const r=await fetch(url,{headers:{"User-Agent":"YazoniPluginDownloader/1.0"},cache:"no-store"});if(!r.ok)throw new Error(`Provider returned ${r.status}`);return r.json();}
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get("q")?.trim()??"";const source=req.nextUrl.searchParams.get("source")??"modrinth";
 if(q.length<2)return NextResponse.json({results:[]});
 try{
  if(source==="modrinth"){
   const data=await json("https://api.modrinth.com/v2/search?query="+encodeURIComponent(q)+"&facets="+encodeURIComponent('[["project_type:plugin"]]')+"&limit=24");
   const results=(data.hits??[]).map((x:any):Result=>({id:x.project_id,name:x.title,description:x.description,icon:x.icon_url,downloads:x.downloads,version:x.latest_version,source:"Modrinth"}));
   return NextResponse.json({results});
  }
  const data=await json("https://api.spiget.org/v2/search/resources/"+encodeURIComponent(q)+"?field=name&size=24");
  const results=(Array.isArray(data)?data:[]).map((x:any):Result=>({id:String(x.id),name:x.name,description:x.tag??x.description??"",icon:x.icon?.url?("https://www.spigotmc.org/"+x.icon.url):undefined,downloads:x.downloads,version:x.version?.name,source:"Spigot"}));
  return NextResponse.json({results});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Search failed"},{status:502});}
}