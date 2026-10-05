import {NextRequest,NextResponse} from "next/server";
type Result={id:string;name:string;description:string;icon?:string;downloads?:number;version?:string;source:"Modrinth"|"Spigot";versions?:{id:string;name:string;gameVersions?:string[];loaders?:string[]}[]};
async function json(url:string){const r=await fetch(url,{headers:{"User-Agent":"YazoniPluginDownloader/1.0"},cache:"no-store"});if(!r.ok)throw new Error(`Provider returned ${r.status}`);return r.json();}
async function modrinthVersions(id:string){const data=await json("https://api.modrinth.com/v2/project/"+encodeURIComponent(id)+"/version?limit=100");return (data??[]).map((v:any)=>({id:v.id,name:v.version_number||v.name||v.id,gameVersions:v.game_versions??[],loaders:v.loaders??[]}));}
function mapModrinth(x:any,versions?:Result["versions"]):Result{return {id:x.project_id,name:x.title,description:x.description??"",icon:x.icon_url,downloads:x.downloads,version:x.latest_version,source:"Modrinth",versions};}
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get("q")?.trim()??"";
 const source=req.nextUrl.searchParams.get("source")??"modrinth";
 const popular=req.nextUrl.searchParams.get("popular")==="1";
 const page=Math.max(1,Number(req.nextUrl.searchParams.get("page")||"1")||1);
 const limit=24;
 try{
  if(source==="modrinth"){
   let url:string;
   const offset=(page-1)*limit;
   if(popular){
    url="https://api.modrinth.com/v2/search?facets="+encodeURIComponent('[[\"project_type:plugin\"]]')+"&index=downloads&limit="+limit+"&offset="+offset;
   }else{
    if(q.length<2)return NextResponse.json({results:[],page,hasMore:false});
    url="https://api.modrinth.com/v2/search?query="+encodeURIComponent(q)+"&facets="+encodeURIComponent('[[\"project_type:plugin\"]]')+"&index=relevance&limit="+limit+"&offset="+offset;
   }
   const data=await json(url);
   const hits=data.hits??[];
   const results=await Promise.all(hits.map(async(x:any)=>mapModrinth(x,await modrinthVersions(x.project_id))));
   return NextResponse.json({results,page,hasMore:page*limit<(data.total_hits??0)});
  }
  const offset=(page-1)*limit;
  if(popular){
   const data=await json("https://api.spiget.org/v2/resources?size="+limit+"&sort=-downloads&page="+(page-1));
   const results=(Array.isArray(data)?data:[]).map((x:any):Result=>({id:String(x.id),name:x.name,description:x.tag??x.description??"",icon:x.icon?.url?("https://www.spigotmc.org/"+x.icon.url):undefined,downloads:x.downloads,version:x.version?.name,source:"Spigot",versions:x.version?.name?[{id:String(x.version.id??x.version.name),name:x.version.name}]:[]}));
   return NextResponse.json({results,page,hasMore:results.length===limit});
  }
  if(q.length<2)return NextResponse.json({results:[],page,hasMore:false});
  const data=await json("https://api.spiget.org/v2/search/resources/"+encodeURIComponent(q)+"?field=name&size="+limit+"&page="+(page-1));
  const results=(Array.isArray(data)?data:[]).map((x:any):Result=>({id:String(x.id),name:x.name,description:x.tag??x.description??"",icon:x.icon?.url?("https://www.spigotmc.org/"+x.icon.url):undefined,downloads:x.downloads,version:x.version?.name,source:"Spigot",versions:x.version?.name?[{id:String(x.version.id??x.version.name),name:x.version.name}]:[]}));
  return NextResponse.json({results,page,hasMore:results.length===limit});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Search failed"},{status:502});}
}