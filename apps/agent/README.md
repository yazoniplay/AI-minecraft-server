# Local Server Agent

Runs on the machine that owns the Minecraft server. The intended control-plane connection is outbound; do not expose the server filesystem or management port directly to the public internet.

## Configure
1. Install Node.js 20+ and pnpm.
2. Copy `.env.example` to `.env` and set `MINECRAFT_SERVER_DIR`.
3. Place the server jar in that directory and configure the correct Java runtime.
4. From the repository root, run `pnpm install` and `pnpm --filter @yazoni/agent dev`.

The process runtime uses `spawn` with `shell:false`, confines file paths to the configured server directory, keeps a bounded console buffer, and refuses to start when the configured jar is missing.

## Current status
The process and filesystem adapters are real. Pairing transport, plugin installation, backups, and richer metrics are separate modules under active development. This bootstrap does not open a network listener.
