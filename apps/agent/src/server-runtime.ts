import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {SecureFilesystem} from "./secure-filesystem.js";
import type {ServerRuntime} from "@yazoni/tools";
import type {ServerStatus} from "@yazoni/core";

export class MinecraftRuntime implements ServerRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;
  private output: string[] = [];
  private readonly files: SecureFilesystem;
  private readonly root: string;
  private readonly javaPath: string;
  private readonly jarName: string;
  private readonly maxMemory: string;

  constructor(options:{root:string;javaPath?:string;jarName?:string;maxMemory?:string}) {
    this.root=path.resolve(options.root);
    this.files=new SecureFilesystem(this.root);
    this.javaPath=options.javaPath??"java";
    this.jarName=options.jarName??"server.jar";
    this.maxMemory=options.maxMemory??"2G";
  }

  private push(line:string) {
    this.output.push(line);
    if(this.output.length>3000)this.output.splice(0,this.output.length-3000);
  }

  async status():Promise<ServerStatus> {
    let version:string|undefined;
    try {
      const p=JSON.parse(await this.files.read("version.json",100_000)) as {id?:string;name?:string};
      version=p.id??p.name;
    } catch {}
    const stat=await fs.statfs(this.root).catch(()=>null);
    return {
      state:this.child&&!this.child.killed?"online":"offline",
      minecraftVersion:version,
      players:0,
      diskFreeBytes:stat?stat.bavail*stat.bsize:undefined
    };
  }

  async start():Promise<void> {
    if(this.child&&!this.child.killed)throw new Error("Server process already exists.");
    if(!(await this.files.exists(this.jarName)))throw new Error("Server jar not found: "+this.jarName);
    const child=spawn(this.javaPath,["-Xms1G","-Xmx"+this.maxMemory,"-jar",this.jarName,"nogui"],{cwd:this.root,stdio:["pipe","pipe","pipe"],shell:false});
    this.child=child;
    child.stdout.setEncoding("utf8").on("data",(chunk:string)=>chunk.split(/\r?\n/).filter(Boolean).forEach(line=>this.push(line)));
    child.stderr.setEncoding("utf8").on("data",(chunk:string)=>chunk.split(/\r?\n/).filter(Boolean).forEach(line=>this.push("[stderr] "+line)));
    child.on("error",e=>this.push("[process error] "+e.message));
    child.on("close",(code,signal)=>{this.push("[process exited] code="+code+" signal="+signal);if(this.child===child)this.child=null;});
  }

  async stop():Promise<void> {
    if(!this.child)return;
    const child=this.child;
    if(child.stdin.writable)child.stdin.write("stop\n");
    await new Promise<void>(resolve=>{
      const timeout=setTimeout(()=>{if(child.exitCode===null)child.kill("SIGTERM");resolve();},15000);
      child.once("close",()=>{clearTimeout(timeout);resolve();});
    });
  }

  async restart():Promise<void> { await this.stop(); await this.start(); }

  async console(command:string):Promise<string> {
    if(!this.child||this.child.exitCode!==null)throw new Error("Server is not running.");
    if(/[\r\n\0]/.test(command))throw new Error("Console command must be a single line.");
    const start=this.output.length;
    this.child.stdin.write(command+"\n");
    await new Promise(resolve=>setTimeout(resolve,250));
    return this.output.slice(start).join("\n");
  }

  async readFile(relativePath:string):Promise<string>{return this.files.read(relativePath);}
  async writeBinary(relativePath:string,content:Uint8Array):Promise<void>{return this.files.writeBytes(relativePath,content);}
  async writeFile(relativePath:string,content:string):Promise<void>{return this.files.write(relativePath,content);}
  async deleteFile(relativePath:string):Promise<void>{return this.files.remove(relativePath);}
  async listFiles(relativePath:string):Promise<string[]>{return this.files.list(relativePath);}
  getRecentConsole(limit=200):string[]{return this.output.slice(-limit);}
  async ensureDirectory(relativePath:string):Promise<void>{return this.files.mkdir(relativePath);}
  async fileExists(relativePath:string):Promise<boolean>{return this.files.exists(relativePath);}
  getServerRoot():string{return this.root;}
}
