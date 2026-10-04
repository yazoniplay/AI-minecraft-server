import type {PluginCandidate} from "@yazoni/core";

export interface PluginProvider {
  search(query:string,minecraftVersion?:string):Promise<PluginCandidate[]>;
  versions(id:string):Promise<PluginCandidate[]>;
  download(candidate:PluginCandidate):Promise<Uint8Array>;
}

export class ModrinthProvider implements PluginProvider {
  constructor(private readonly apiBase="https://api.modrinth.com/v2") {}
  async search(query:string,minecraftVersion?:string):Promise<PluginCandidate[]> {
    const url=new URL(this.apiBase+"/search");
    url.searchParams.set("query",query);
    url.searchParams.set("facets",JSON.stringify(minecraftVersion?[["project_type:plugin"],["versions:"+minecraftVersion]]:[["project_type:plugin"]]));
    const response=await fetch(url);
    if(!response.ok)throw new Error("Modrinth search failed: "+response.status);
    const data=await response.json() as {hits?:Array<{project_id:string;title:string}>};
    return(data.hits??[]).map(hit=>({id:hit.project_id,name:hit.title,source:"modrinth" as const,version:"latest",minecraftVersions:minecraftVersion?[minecraftVersion]:[],dependencies:[]}));
  }
  async versions(id:string):Promise<PluginCandidate[]> {
    const response=await fetch(this.apiBase+"/project/"+encodeURIComponent(id)+"/version");
    if(!response.ok)throw new Error("Modrinth versions failed: "+response.status);
    const data=await response.json() as Array<{version_number:string;game_versions:string[];dependencies:Array<{project_id?:string;version_id?:string}>;files:Array<{url:string}>}>;
    return data.map(version=>({id,name:id,source:"modrinth" as const,version:version.version_number,minecraftVersions:version.game_versions,dependencies:version.dependencies.map(dep=>dep.project_id??dep.version_id??"").filter(Boolean),...(version.files[0]?.url?{downloadUrl:version.files[0].url}:{})}));
  }
  async download(candidate:PluginCandidate):Promise<Uint8Array> {
    if(!candidate.downloadUrl)throw new Error("No download URL is available.");
    const response=await fetch(candidate.downloadUrl);
    if(!response.ok)throw new Error("Plugin download failed: "+response.status);
    return new Uint8Array(await response.arrayBuffer());
  }
}

type SpigetResource={id:number;name:string;tag?:string;version?:string;testedVersions?:string[];downloads?:number};
type SpigetVersion={name?:string;version?:string;releaseDate?:number};

export class SpigotProvider implements PluginProvider {
  private readonly api="https://api.spiget.org/v2";
  async search(query:string,minecraftVersion?:string):Promise<PluginCandidate[]> {
    const url=new URL(this.api+"/search/resources/"+encodeURIComponent(query));
    url.searchParams.set("size","20");url.searchParams.set("sort","-downloads");
    const response=await fetch(url);
    if(!response.ok)throw new Error("Spigot resource search failed: "+response.status);
    const data=await response.json() as SpigetResource[];
    return data.filter(item=>!minecraftVersion||!item.testedVersions?.length||item.testedVersions.includes(minecraftVersion)).map(item=>({
      id:String(item.id),name:item.name,source:"spigot" as const,version:item.version??"latest",
      minecraftVersions:item.testedVersions??[],dependencies:[],downloadUrl:this.api+"/resources/"+item.id+"/download"
    }));
  }
  async versions(id:string):Promise<PluginCandidate[]> {
    if(!/^\d+$/.test(id))throw new Error("Spigot resource ID must be numeric.");
    const [resourceResponse,versionsResponse]=await Promise.all([
      fetch(this.api+"/resources/"+id),
      fetch(this.api+"/resources/"+id+"/versions?size=20&sort=-releaseDate")
    ]);
    if(!resourceResponse.ok)throw new Error("Spigot resource lookup failed: "+resourceResponse.status);
    const resource=await resourceResponse.json() as SpigetResource;
    const versions=versionsResponse.ok?await versionsResponse.json() as SpigetVersion[]:[];
    const rows=versions.length?versions:[{version:resource.version}];
    return rows.map(v=>({id,name:resource.name,source:"spigot" as const,version:v.version??v.name??"latest",minecraftVersions:resource.testedVersions??[],dependencies:[],downloadUrl:this.api+"/resources/"+id+"/download"}));
  }
  async download(candidate:PluginCandidate):Promise<Uint8Array> {
    if(candidate.source!=="spigot"||!/^\d+$/.test(candidate.id))throw new Error("Invalid Spigot resource.");
    const response=await fetch(this.api+"/resources/"+candidate.id+"/download",{redirect:"follow"});
    if(!response.ok)throw new Error("Spigot download failed: "+response.status);
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.length<4||bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error("Spigot response was not a JAR/ZIP archive.");
    return bytes;
  }
}
