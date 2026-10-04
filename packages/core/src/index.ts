export type RiskLevel="safe"|"moderate"|"destructive"|"critical";
export type ToolContext={requestId:string;actorId:string;serverId:string;dryRun:boolean;approved:boolean};
export type ToolDefinition<I=unknown,O=unknown>={name:string;description:string;risk:RiskLevel;input:unknown;execute:(input:I,context:ToolContext)=>Promise<O>};
export type ServerStatus={state:"online"|"offline"|"starting"|"stopping"|"unknown";minecraftVersion?:string;serverSoftware?:string;players:number;tps?:number;mspt?:number;memoryBytes?:number;cpuPercent?:number;diskFreeBytes?:number};
export type PluginSource="modrinth"|"spigot"|"local";
export type PluginCandidate={id:string;name:string;source:PluginSource;version:string;minecraftVersions:string[];dependencies:string[];downloadUrl?:string};
export type AuditEvent={id:string;timestamp:string;actorId:string;serverId:string;tool:string;risk:RiskLevel;input:unknown;outcome:"success"|"failure"|"denied"|"dry-run";error?:string};
export type Job={id:string;serverId:string;status:"queued"|"planning"|"running"|"waiting_approval"|"completed"|"failed"|"cancelled";goal:string;steps:Array<{id:string;tool:string;status:string}>};
