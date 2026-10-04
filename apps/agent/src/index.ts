import {createServerTools} from "@yazoni/tools";
import {createManagementTools} from "./management-tools.js";
import {createConfigurationTools} from "./configuration-tools.js";
import {MinecraftRuntime} from "./server-runtime.js";
import {AuditLogger} from "./audit.js";

const root=process.env.MINECRAFT_SERVER_DIR;
if(!root) {
  console.error("Set MINECRAFT_SERVER_DIR to the directory containing your Minecraft server jar.");
  process.exitCode=1;
} else {
  const runtime=new MinecraftRuntime({
    root,
    javaPath:process.env.JAVA_PATH??"java",
    jarName:process.env.MINECRAFT_SERVER_JAR??"server.jar",
    maxMemory:process.env.MINECRAFT_MAX_MEMORY??"2G"
  });
  const audit=new AuditLogger(root);
  const tools=audit.wrap([...createServerTools(runtime),...createManagementTools(runtime),...createConfigurationTools(runtime)]);
  console.log("Yazoni Server Agent ready.");
  console.log("Server directory:",runtime.getServerRoot());
  console.log("Registered tools:",tools.length);
  for(const tool of tools) console.log(" -",tool.name,"["+tool.risk+"]");
  console.log("No public network listener is opened by this local bootstrap.");
}
