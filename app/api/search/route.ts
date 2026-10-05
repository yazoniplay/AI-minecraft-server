import {NextRequest,NextResponse} from "next/server";
type Result={id:string;name:string;description:string;icon?:string;downloads?:number;version?:string;source:"Modrinth"|"Spigot";versions?:{id:string;name:string;gameVersions?:string[];loaders?:string[]}[]};
async function json(url:string){const r=await fetch(url,{headers:{"User-Agent":"YazoniPluginDownloader/1.0"},cache:"no-store"});if(!r.ok)throw new Error(`Provider returned ${r.status}`);return r.json();}
async function modrinthVersions(id:string){const data=await json("https://api.modrinth.com/v2/project/"+encodeURIComponent(id)+"/version?limit=100");return (data??[]).map((v:any)=>({id:v.id,name:v.version_number||v.name||v.id,gameVersions:v.game_versions??[],loaders:v.loaders??[]}));}
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get("q")?.trim()??"";const source=req.nextUrl.searchParams.get("source")??"modrinth";const popular=req.nextUrl.searchParams.get("popular")==="1";
 try{
  if(source==="modrinth"){
   let url:string;
   if(popular) url="https://api.modrinth.com/v2/search?facets="+encodeURIComponent('[[\"project_type:plugin\"]]')+"&sort=downloads&order=desc&limit=24";
   else {if(q.length<2)return NextResponse.json({results:[]});url="https://api.modrinth.com/v2/search?query="+encodeURIComponent(q)+"&facets="+encodeURIComponent('[[\"project_type:plugin\"]]')+"&limit=24";}
   const data=await json(url);
   const results=await Promise.all((data.hits??[]).map(async(x:any):Promise<Result>=>({id:x.project_id,name:x.title,description:x.description,icon:x.icon_url,downloads:x.downloads,version:x.latest_version,source:"Modrinth",versions:await modrinthVersions(x.project_id)})));
   return NextResponse.json({results});
  }
  if(popular){
   const data=await json("https://api.spiget.org/v2/resources?size=24&sort=-downloads");
   const results=(Array.isArray(data)?data:[]).map((x:any):Result=>({id:String(x.id),name:x.name,description:x.tag??x.description??"",icon:x.icon?.url?("https://www.spigotmc.org/"+x.icon.url):undefined,downloads:x.downloads,version:x.version?.name,source:"Spigot",versions:x.version?.name?[{id:String(x.version.id??x.version.name),name:x.version.name}]:[]}));
   return NextResponse.json({results});
  }
  if(q.length<2)return NextResponse.json({results:[]});
  const data=await json("https://api.spiget.org/v2/search/resources/"+encodeURIComponent(q)+"?field=name&size=24");
  const results=(Array.isArray(data)?data:[]).map((x:any):Result=>({id:String(x.id),name:x.name,description:x.tag??x.description??"",icon:x.icon?.url?("https://www.spigotmc.org/"+x.icon.url):undefined,downloads:x.downloads,version:x.version?.name,source:"Spigot",versions:x.version?.name?[{id:String(x.version.id??x.version.name),name:x.version.name}]:[]}));
  return NextResponse.json({results});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Search failed"},{status:502});}
}