import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {SecureFilesystem} from "./secure-filesystem.js";
import type {ServerRuntime} from "@yazoni/tools";
import type {ServerStatus} from "@yazoni/core";

export class MinecraftRuntime implements ServerRuntime {
  private child: ChildProcessWithoutNullStreams | null = null;
  private output: string[] = [];
  private ready = false;
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
    if(line.includes("Done (") || line.includes("For help, type")) this.ready = true;
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
    const versionLine=this.output.slice().reverse().find(line=>/Starting minecraft server version/i.test(line));
    const detectedVersion=version??versionLine?.match(/version\s+([0-9.]+)/i)?.[1];
    const playerLine=this.output.slice().reverse().find(line=>/There are \d+ of a max of \d+ players online/i.test(line));
    const playerCount=playerLine?Number(playerLine.match(/There are (\d+)/i)?.[1]??0):0;
    const running=!!this.child&&this.child.exitCode===null;
    return {
      state:!running?"offline":this.ready?"online":"starting",
      ...(detectedVersion ? {minecraftVersion:detectedVersion} : {}),
      players:playerCount,
      ...(stat ? {diskFreeBytes:stat.bavail*stat.bsize} : {})
    };
  }

  async start():Promise<void> {
    if(this.child&&!this.child.killed)throw new Error("Server process already exists.");
    if(!(await this.files.exists(this.jarName)))throw new Error("Server jar not found: "+this.jarName);
    const child=spawn(this.javaPath,["-Xms512M","-Xmx"+this.maxMemory,"-jar",this.jarName,"nogui"],{cwd:this.root,stdio:["pipe","pipe","pipe"],shell:false});
    this.child=child;
    this.ready=false;
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
      let settled=false;
      let graceful:ReturnType<typeof setTimeout>;
      let force:ReturnType<typeof setTimeout>;
      const finish=()=>{if(settled)return;settled=true;clearTimeout(graceful);clearTimeout(force);resolve();};
      graceful=setTimeout(()=>{if(child.exitCode===null)child.kill("SIGTERM");},15000);
      force=setTimeout(()=>{if(child.exitCode===null)child.kill("SIGKILL");finish();},20000);
      child.once("close",finish);
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
