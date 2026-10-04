import {promises as fs} from "node:fs";
import path from "node:path";

export class SecureFilesystem {
  readonly root: string;
  constructor(root: string) { this.root = path.resolve(root); }

  resolve(relativePath: string): string {
    if (typeof relativePath !== "string" || !relativePath.trim()) throw new Error("A relative path is required.");
    if (path.isAbsolute(relativePath)) throw new Error("Absolute paths are not allowed.");
    const resolved = path.resolve(this.root, relativePath);
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) throw new Error("Path escapes the configured server directory.");
    return resolved;
  }

  async list(relativePath = "."): Promise<string[]> {
    const entries = await fs.readdir(this.resolve(relativePath), {withFileTypes:true});
    return entries.map(e => (e.isDirectory() ? "[dir] " : "[file] ") + e.name);
  }

  async read(relativePath: string, maxBytes = 2_000_000): Promise<string> {
    const target = this.resolve(relativePath);
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new Error("Only regular files can be read.");
    if (stat.size > maxBytes) throw new Error("File is too large to read in one operation.");
    return fs.readFile(target, "utf8");
  }

  async write(relativePath: string, content: string): Promise<void> {
    const target = this.resolve(relativePath);
    await fs.mkdir(path.dirname(target), {recursive:true});
    const temp = target + ".yazoni-tmp";
    await fs.writeFile(temp, content, {encoding:"utf8", flag:"w"});
    await fs.rename(temp, target);
  }

  async writeBytes(relativePath: string, content: Uint8Array): Promise<void> {
    const target = this.resolve(relativePath);
    await fs.mkdir(path.dirname(target), {recursive:true});
    const temp = target + ".yazoni-tmp";
    await fs.writeFile(temp, content, {flag:"w"});
    await fs.rename(temp, target);
  }

  async remove(relativePath: string): Promise<void> {
    const target = this.resolve(relativePath);
    if (target === this.root) throw new Error("Cannot delete the server root.");
    await fs.rm(target, {recursive:false, force:false});
  }

  async mkdir(relativePath: string): Promise<void> {
    await fs.mkdir(this.resolve(relativePath), {recursive:true});
  }

  async exists(relativePath: string): Promise<boolean> {
    try { await fs.access(this.resolve(relativePath)); return true; } catch { return false; }
  }
}
