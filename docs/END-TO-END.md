# End-to-end operator flow

The production path is:

1. Start the control plane with CONTROL_ADMIN_TOKEN and PAIRING_CODE.
2. Start the Minecraft agent with MINECRAFT_SERVER_DIR, GEMINI_API_KEY, CONTROL_PLANE_URL, SERVER_ID, and PAIRING_CODE.
3. The agent exchanges the pairing code for a per-server token and stores it as .yazoni-agent-token.
4. The dashboard submits a natural-language goal to the control plane.
5. The agent polls the authenticated command queue and gives the goal to Gemini 3.5 Flash-Lite with the registered tool schemas. Gemini 3.5 Flash-Lite supports function calling, including parallel and compositional function calling. 
6. Safe inspection tools can execute immediately. Risky, destructive, and critical tools pause the job.
7. The dashboard shows the exact pending operation and provides an explicit approval action.
8. Approval queues the same goal with approved=true; the agent re-plans against the now-authorized state rather than blindly replaying a prior mutation.
9. The agent executes the required tools, records audit events, and sends job, status, and console events back to the control plane.
10. The dashboard polls the control plane every second, showing live status, players, console output, and job progress.
11. Plugin installation can recursively resolve required Modrinth dependencies and select versions compatible with the target Minecraft version.
12. Backups can be restored; restores create a pre-restore safety snapshot, and backups.rollback restores the newest safety snapshot.
13. pnpm --filter @yazoni/agent test includes an orchestration E2E test for a complete prison-server transformation and verification flow.

The browser never receives the control-plane admin token; the Next.js route handler proxies dashboard actions server-side. The local agent only receives a scoped per-server token after pairing. Pairing is one-time; losing the stored agent token requires issuing a new pairing code.