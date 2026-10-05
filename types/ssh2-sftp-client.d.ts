declare module "ssh2-sftp-client" {
  interface SftpConfig {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  }

  class SftpClient {
    connect(config: SftpConfig): Promise<this>;
    exists(path: string): Promise<boolean | string>;
    mkdir(path: string, recursive?: boolean): Promise<string | undefined>;
    put(input: Buffer | string, remotePath: string): Promise<void>;
    end(): Promise<void>;
  }

  export default SftpClient;
}
