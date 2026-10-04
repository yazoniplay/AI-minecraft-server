import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {SecureFilesystem} from "../src/secure-filesystem.js";

test("filesystem confines paths to its configured root",async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),"yazoni-agent-"));
 try{
  const root=path.join(temp,"server");await import("node:fs/promises").then(fs=>fs.mkdir(root));
  const files=new SecureFilesystem(root);
  await files.write("plugins/example.txt","safe");
  assert.equal(await files.read("plugins/example.txt"),"safe");
  assert.throws(()=>files.resolve("../outside.txt"),/escapes/);
  assert.throws(()=>files.resolve(path.join(temp,"outside.txt")),/Absolute/);
  await assert.rejects(files.remove("."),/Cannot remove/);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test("filesystem writes binary artifacts atomically",async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),"yazoni-agent-"));
 try{
  const files=new SecureFilesystem(temp);await files.writeBytes("plugins/test.jar",new Uint8Array([0x50,0x4b,0x03,0x04]));
  assert.deepEqual([...await import("node:fs/promises").then(fs=>fs.readFile(path.join(temp,"plugins/test.jar")))], [0x50,0x4b,0x03,0x04]);
 }finally{await rm(temp,{recursive:true,force:true});}
});
