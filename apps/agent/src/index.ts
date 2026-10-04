import {createServerTools} from "@yazoni/tools";
import {MinecraftRuntime} from "./server-runtime.js";

const root=process.env.MINECRAFT_SERVER_DIR;
if(!root) {
  console.error("Set MINECRAFT_SERVER_DIR to the directory containing your Minecraft server jar.");
  process.exitCode=1;
} else {
  const runtime=new MinecraftRuntime({
    root,
    javaPath:process.env.JAVA_PATH,
    jarName:process.env.MINECRAFT_SERVER_JAR??"server.jar",
    maxMemory:process.env.MINECRAFT_MAX_MEMORY??"2G"
  });
  const tools=createServerTools(runtime);
  console.log("Yazoni Server Agent ready.");
  console.log("Server directory:",runtime.getServerRoot());
  console.log("Registered tools:",tools.map(t=>t.name).join(", "));
  console.log("No public network listener is opened by this local bootstrap.");
}
