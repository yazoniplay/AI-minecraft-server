# Yazoni Server AI

An AI-native Minecraft server operations platform. The goal is to let an operator describe an outcome in natural language while an agent inspects the server, plans changes, runs permissioned tools, verifies the result and records an audit trail.

## Architecture

- `apps/web` — Next.js operator dashboard shell
- `apps/agent` — local process manager, filesystem sandbox and server-management tools
- `packages/core` — shared domain contracts
- `packages/tools` — typed tool interfaces and foundational server/file tools
- `packages/providers` — Modrinth and Spiget-backed Spigot resource provider adapters
- `packages/ai` — model-provider abstraction and multi-step tool orchestration
- `docs/TOOL-CATALOG.md` — currently implemented capabilities and explicit gaps

## Implemented foundation

- Java process lifecycle with `shell:false`, bounded console buffer and startup readiness detection
- Path-confined filesystem access with atomic text/binary writes
- Server console command tool
- Modrinth search, version metadata and plugin artifact download/install
- Plugin listing and removal
- World listing and server.properties world selection
- Player kick, ban, whitelist, op/deop, gamemode and give tools
- server.properties read/update/validation
- Local file-copy backups and backup listing
- Console diagnostics
- Redacted append-only JSONL audit events
- Risk tiers and explicit approval checks on mutating operations
- Filesystem unit tests and GitHub Actions CI workflow

## Local setup

Requirements: Node.js 22+, Java appropriate for your Minecraft server, and pnpm 10+.

1. Copy `apps/agent/.env.example` to `apps/agent/.env`.
2. Set `MINECRAFT_SERVER_DIR` to the directory containing your server jar.
3. Set `MINECRAFT_SERVER_JAR` and `MINECRAFT_MAX_MEMORY` as needed.
4. From the repository root run `pnpm install`.
5. Run `pnpm --filter @yazoni/agent test`.
6. Run `pnpm --filter @yazoni/agent typecheck`.
7. Run `pnpm --filter @yazoni/agent dev`.

The agent currently initializes its local tool registry and runtime; it does not yet expose a remote control-plane listener. Do not assume the dashboard chat is connected to a live AI agent.

## Security

- The local runtime uses a configured server-root sandbox and rejects absolute paths/path traversal.
- The process manager does not expose arbitrary operating-system shell execution.
- Mutating tools require explicit approval in their execution context.
- Audit logging redacts likely secrets and large file contents.
- Do not commit real tokens or API keys.
- Stop the server before creating a backup if you need a consistent copy of active world data.

## Current gaps

This is active development, not a finished product. The next major work is a secure pairing/control-plane protocol, a real model provider connected to the tool loop, an approval UI, restore/rollback, live metrics/TPS, automatic dependency resolution, broader plugin compatibility checks, and end-to-end integration tests.
