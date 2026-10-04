import SftpClient from "ssh2-sftp-client";
import {promises as fs} from "node:fs";
import path from "node:path";
import type {ServerRuntime} from "@yazoni/tools";
import type {ServerStatus} from "@yazoni/core";

export class EternalZeroRuntime implements ServerRuntime {
  readonly kind="eternalzero-sftp" as const;
  private readonly clientConfig:SftpClient.ConnectOptions;
  private readonly root:string;
  private readonly cacheRoot:string;
  private readonly host:string;

  constructor(options:{host:string;port?:number;username:string;password?:string|undefined;privateKey?:string|undefined;root?:string;cacheRoot?:string}) {
    this.host=options.host;
    this.root=(options.root??".").replace(/\\/g,"/").replace(/\/$/,"")||".";
    this.cacheRoot=path.resolve(options.cacheRoot??"./.yazoni-eternalzero-cache");
    this.clientConfig={host:options.host,port:options.port??22,username:options.username,...(options.password?{password:options.password}:{}),...(options.privateKey?{privateKey:options.privateKey}:{}),readyTimeout:15000};
    if(!options.password&&!options.privateKey)throw new Error("EternalZero SFTP requires ETERNALZERO_SFTP_PASSWORD or ETERNALZERO_SFTP_PRIVATE_KEY.");
  }

  private remotePath(relativePath:string){const clean=relativePath.replace(/\\/g,"/").replace(/^\/+/, "");if(clean.split("/").some(p=>p===".."||p==="."&&clean.includes("..")))throw new Error("Invalid remote path.");return this.root+(clean?"/"+clean:"");}
  private async withClient<T>(fn:(s:SftpClient)=>Promise<T>):Promise<T>{const s=new SftpClient();try{await s.connect(this.clientConfig);return await fn(s)}finally{await s.end().catch(()=>{})}}

  async status():Promise<ServerStatus>{
    let version:string|undefined;
    try{const raw=await this.readFile("version.json");const v=JSON.parse(raw) as {id?:string;name?:string};version=v.id??v.name}catch{}
    return {state:"unknown",players:0,...(version?{minecraftVersion:version}:{} )};
  }

  async start():Promise<void>{throw new Error("EternalZero controls server start from its dashboard. Start the server there.");}
  async stop():Promise<void>{throw new Error("EternalZero controls server stop from its dashboard. Stop the server there.");}
  async restart():Promise<void>{throw new Error("EternalZero controls server restart from its dashboard. Restart the server there.");}
  async console(_command:string):Promise<string>{throw new Error("EternalZero SFTP does not expose the live console to the agent. Use the EternalZero console; file/plugin management remains available.");}

  async readFile(relativePath:string):Promise<string>{return this.withClient(async s=>String(await s.get(this.remotePath(relativePath))));}
  async writeFile(relativePath:string,content:string):Promise<void>{await this.withClient(s=>s.put(Buffer.from(content,"utf8"),this.remotePath(relativePath)));}
  async writeBinary(relativePath:string,content:Uint8Array):Promise<void>{await this.withClient(s=>s.put(Buffer.from(content),this.remotePath(relativePath)));}
  async deleteFile(relativePath:string):Promise<void>{await this.withClient(s=>s.delete(this.remotePath(relativePath)));}
  async listFiles(relativePath:string):Promise<string[]>{return this.withClient(async s=>{const rows=await s.list(this.remotePath(relativePath));return rows.map((x:{name:string})=>x.name);});}
  async ensureDirectory(relativePath:string):Promise<void>{await this.withClient(s=>s.mkdir(this.remotePath(relativePath),true));}
  async fileExists(relativePath:string):Promise<boolean>{return this.withClient(async s=>{try{await s.stat(this.remotePath(relativePath));return true}catch{return false}});}
  getRecentConsole(_limit=200):string[]{return [];}
  getServerRoot():string{return this.cacheRoot;}
}