declare module "ssh2-sftp-client" {
  export interface ConnectOptions {
    host:string;
    port?:number;
    username:string;
    password?:string;
    privateKey?:string;
    readyTimeout?:number;
  }
  interface FileInfo { name:string }
  class SftpClient {
    connect(config:ConnectOptions):Promise<this>;
    get(path:string):Promise<Buffer|string>;
    put(input:Buffer|string|Uint8Array,path:string):Promise<void>;
    delete(path:string):Promise<void>;
    list(path:string):Promise<FileInfo[]>;
    mkdir(path:string,recursive?:boolean):Promise<void>;
    stat(path:string):Promise<unknown>;
    end():Promise<void>;
  }
  export default SftpClient;
}