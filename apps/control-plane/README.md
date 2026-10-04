# Yazoni Control Plane

The control plane is the authenticated bridge between the web dashboard and a local Minecraft agent.

## Environment

- CONTROL_ADMIN_TOKEN: secret used only by the web server.
- PAIRING_CODE: one-time/installation pairing secret shared with the local agent during pairing.
- CONTROL_STATE_FILE: optional path for persisted state.
- PORT: HTTP port, default 8787.

The browser never receives the admin token. The local agent authenticates with its per-server token after pairing. The control plane exposes jobs, approvals, agent heartbeats, console events and server status.