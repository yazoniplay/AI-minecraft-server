import {promises as fs} from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import type {ToolContext,ToolDefinition,PluginCandidate} from "@yazoni/core";
import {ModrinthProvider,SpigotProvider} from "@yazoni/providers";
import {MinecraftRuntime} from "./server-runtime.js";

const approve=(c:ToolContext)=>{if(!c.dryRun&&!c.approved)throw new Error("This action requires explicit approval.");};
const object=(v:unknown)=>typeof v==="object"&&v!==null?v as Record<string,unknown>:{};
const text=(v:unknown)=>typeof v==="string"?v:"";

export function createManagementTools(runtime:MinecraftRuntime):ToolDefinition[]{
 const modrinth=new ModrinthProvider();const spigot=new SpigotProvider();
 const backupsRoot=path.resolve(runtime.getServerRoot(),"..","."+path.basename(runtime.getServerRoot())+"-yazoni-backups");
 const installTree=async(projectId:string,targetVersion:string|undefined,minecraftVersion:string|undefined,seen=new Set<string>()):Promise<unknown[]>=>{
  if(seen.has(projectId))return[];seen.add(projectId);
  const versions=await modrinth.versions(projectId);
  const compatible=versions.filter(v=>!minecraftVersion||v.minecraftVersions.length===0||v.minecraftVersions.includes(minecraftVersion));
  const chosen=compatible.find(v=>targetVersion&&v.version===targetVersion)??compatible[0];
  if(!chosen)throw new Error("No compatible published version found for "+projectId+(minecraftVersion?" on "+minecraftVersion:"")+".");
  if(!chosen.downloadUrl)throw new Error("Selected version has no downloadable file: "+projectId);
  const installed:unknown[]=[];
  for(const dependency of chosen.dependencies)installed.push(...await installTree(dependency,undefined,minecraftVersion,seen));
  const bytes=await modrinth.download(chosen);
  const safe=projectId.replace(/[^a-zA-Z0-9._-]/g,"-");
  const filename=safe+"-"+chosen.version.replace(/[^a-zA-Z0-9._-]/g,"-")+".jar";
  await runtime.ensureDirectory("plugins");await runtime.writeBinary("plugins/"+filename,bytes);
  installed.push({projectId,version:chosen.version,filename,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),dependencies:chosen.dependencies});
  return installed;
 };
 const copyBackup=async(target:string)=>{await fs.cp(runtime.getServerRoot(),target,{recursive:true,errorOnExist:true,filter:(src)=>!src.startsWith(backupsRoot)&&!src.endsWith(".yazoni-agent-token")});};
 const restoreSnapshot=async(name:string)=>{
  const source=path.resolve(backupsRoot,name);
  if(!source.startsWith(backupsRoot+path.sep)||!(await fs.stat(source).catch(()=>null)))throw new Error("Backup not found.");
  const wasRunning=(await runtime.status()).state!=="offline";
  if(wasRunning)await runtime.stop();
  const entries=await fs.readdir(runtime.getServerRoot(),{withFileTypes:true});
  for(const entry of entries)if(entry.name!==".yazoni-agent-token")await fs.rm(path.join(runtime.getServerRoot(),entry.name),{recursive:true,force:true});
  await fs.cp(source,runtime.getServerRoot(),{recursive:true,force:true});
  if(wasRunning)await runtime.start();
  return{restored:name,restarted:wasRunning};
 };
 return[
 {name:"plugins.search",description:"Search Modrinth for Minecraft plugins, optionally filtering by game version.",risk:"safe",input:{query:"string",minecraftVersion:"string?"},execute:async(input)=>{const v=object(input);const q=text(v.query).trim();if(!q)throw new Error("Search query required.");return{results:await modrinth.search(q,text(v.minecraftVersion)||undefined)};}},
 {name:"plugins.versions",description:"List published versions and dependency metadata for a Modrinth plugin.",risk:"safe",input:{projectId:"string"},execute:async(input)=>{const id=text(object(input).projectId).trim();if(!id)throw new Error("Project ID required.");return{versions:await modrinth.versions(id)};}},
 {name:"plugins.install",description:"Install a Modrinth plugin and recursively install its required dependencies, selecting versions compatible with the target Minecraft version.",risk:"destructive",input:{projectId:"string",version:"string?",minecraftVersion:"string?"},execute:async(input,c)=>{approve(c);const v=object(input);const id=text(v.projectId).trim();if(!id)throw new Error("Project ID required.");const installed=await installTree(id,text(v.version)||undefined,text(v.minecraftVersion)||undefined);return{installed,restartRequired:true};}},
 {name:"plugins.install_spigot",description:"Install a Spigot/Spiget resource by numeric resource ID.",risk:"destructive",input:{resourceId:"string"},execute:async(input,c)=>{approve(c);const id=text(object(input).resourceId).trim();const versions=await spigot.versions(id);const chosen=versions[0];if(!chosen)throw new Error("No Spigot version found.");const bytes=await spigot.download(chosen);await runtime.ensureDirectory("plugins");const filename=chosen.name.replace(/[^a-zA-Z0-9._-]/g,"-")+"-"+chosen.version.replace(/[^a-zA-Z0-9._-]/g,"-")+".jar";await runtime.writeBinary("plugins/"+filename,bytes);return{installed:true,filename,version:chosen.version,bytes:bytes.length,restartRequired:true};}},
 {name:"plugins.list",description:"List files in the plugins directory.",risk:"safe",input:{},execute:async()=>({plugins:await runtime.listFiles("plugins").catch(()=>[])})},
 {name:"plugins.remove",description:"Remove a plugin jar from the plugins directory. Does not delete its configuration folder.",risk:"destructive",input:{filename:"string"},execute:async(input,c)=>{approve(c);const filename=path.basename(text(object(input).filename));if(!filename.endsWith(".jar")||filename!==text(object(input).filename))throw new Error("Provide a plugin jar filename, not a path.");await runtime.deleteFile("plugins/"+filename);return{removed:filename,restartRequired:true};}},
 {name:"worlds.list",description:"List directories under the Minecraft server worlds root.",risk:"safe",input:{},execute:async()=>({worlds:await fs.readdir(runtime.getServerRoot(),{withFileTypes:true}).then(es=>es.filter(e=>e.isDirectory()&&(/world/i.test(e.name)||e.name==="world")).map(e=>e.name))})},
 {name:"worlds.create",description:"Create a new world by setting level-name and restarting the server. This does not merge worlds.",risk:"destructive",input:{name:"string"},execute:async(input,c)=>{approve(c);const name=text(object(input).name).trim();if(!/^[a-zA-Z0-9_-]{1,48}$/.test(name))throw new Error("World name must use 1-48 letters, numbers, underscores or hyphens.");const current=await runtime.readFile("server.properties").catch(()=> "");if(!current)throw new Error("server.properties is missing or unreadable.");const next=current.match(/^level-name=/m)?current.replace(/^level-name=.*$/m,"level-name="+name):current.trimEnd()+"\nlevel-name="+name+"\n";await runtime.writeFile("server.properties",next);return{configuredWorld:name,restartRequired:true};}},
 {name:"players.kick",description:"Kick a named player with an optional reason.",risk:"moderate",input:{player:"string",reason:"string?"},execute:async(input,c)=>{approve(c);const v=object(input);const player=text(v.player);if(!/^[a-zA-Z0-9_]{1,16}$/.test(player))throw new Error("Invalid Minecraft username.");const reason=text(v.reason).replace(/[\r\n]/g," ").slice(0,120);return{output:await runtime.console("kick "+player+(reason?" "+reason:""))};}},
 {name:"players.ban",description:"Ban a named player with an optional reason.",risk:"destructive",input:{player:"string",reason:"string?"},execute:async(input,c)=>{approve(c);const v=object(input);const player=text(v.player);if(!/^[a-zA-Z0-9_]{1,16}$/.test(player))throw new Error("Invalid Minecraft username.");const reason=text(v.reason).replace(/[\r\n]/g," ").slice(0,120);return{output:await runtime.console("ban "+player+(reason?" "+reason:""))};}},
 {name:"players.whitelist",description:"Add or remove a player from the vanilla whitelist.",risk:"moderate",input:{player:"string",enabled:"boolean"},execute:async(input,c)=>{approve(c);const v=object(input);const player=text(v.player);if(!/^[a-zA-Z0-9_]{1,16}$/.test(player))throw new Error("Invalid Minecraft username.");return{output:await runtime.console((v.enabled===false?"whitelist remove ":"whitelist add ")+player)};}},
 {name:"diagnostics.recent_console",description:"Read recent buffered console output for troubleshooting.",risk:"safe",input:{lines:"number?"},execute:async(input)=>{const n=Math.max(1,Math.min(500,Number(object(input).lines)||100));return{lines:runtime.getRecentConsole(n)};}},
 {name:"backups.create",description:"Create a point-in-time copy of server files outside the live server directory.",risk:"destructive",input:{label:"string?"},execute:async(input,c)=>{approve(c);await fs.mkdir(backupsRoot,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,"-");const label=text(object(input).label).replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,32);const target=path.join(backupsRoot,stamp+(label?"-"+label:""));await copyBackup(target);return{created:true,name:path.basename(target),path:target,note:"For the most consistent world snapshot, stop the server before backing up active world data."};}},
 {name:"backups.list",description:"List available local server snapshots.",risk:"safe",input:{},execute:async()=>({backups:await fs.readdir(backupsRoot,{withFileTypes:true}).then(es=>es.filter(e=>e.isDirectory()).map(e=>e.name).sort().reverse()).catch(()=>[])})},
 {name:"backups.restore",description:"Restore a selected backup, first creating a safety snapshot so the operation can be rolled back.",risk:"critical",input:{name:"string"},execute:async(input,c)=>{approve(c);await fs.mkdir(backupsRoot,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,"-")+"-pre-restore";const safety=path.join(backupsRoot,stamp);await copyBackup(safety);const result=await restoreSnapshot(text(object(input).name));return{...result,safetyBackup:path.basename(safety),rollbackAvailable:true};}},
 {name:"backups.rollback",description:"Roll back to the newest automatic pre-restore safety snapshot.",risk:"critical",input:{},execute:async(_,c)=>{approve(c);const backups=await fs.readdir(backupsRoot,{withFileTypes:true}).then(es=>es.filter(e=>e.isDirectory()&&e.name.includes("-pre-restore")).map(e=>e.name).sort().reverse());if(!backups[0])throw new Error("No automatic rollback snapshot exists.");return restoreSnapshot(backups[0]);}}
 ];
}