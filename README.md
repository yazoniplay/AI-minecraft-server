# Yazoni Server AI

Advanced AI-native control plane for Minecraft servers.

## Vision
Natural-language server operations backed by a large typed tool system. The AI can inspect, plan, execute, verify and explain server changes.

## Packages
- apps/web — operator dashboard
- apps/agent — local machine agent
- packages/core — shared domain contracts
- packages/tools — server/filesystem tools
- packages/providers — Modrinth and Spigot integrations
- packages/ai — tool-driven agent orchestration

## Principles
- Not an unrestricted remote shell.
- Every capability is a typed tool with risk metadata and audit logging.
- Destructive operations require approval.
- Prefer inspection, backups and verification before risky changes.
- Designed for extensibility: plugins, worlds, players, configs, diagnostics, backups, monitoring and more.
