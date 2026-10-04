# Agent tool catalog

Tools are registered by name and risk tier. The AI should inspect before mutating state, request approval for risky operations, and verify results after each important change.

## Server and files
- `server.get_status` — current process state and available basic host metrics
- `server.start`, `server.stop`, `server.restart`
- `server.console` — one-line Minecraft console command
- `files.list`, `files.read`, `files.write`, `files.delete`

## Plugins
- `plugins.search` — search Modrinth plugin projects
- `plugins.versions` — inspect published Modrinth versions and dependency metadata
- `plugins.install` — download a selected Modrinth plugin artifact, validate its ZIP/JAR signature, and install it
- `plugins.list`, `plugins.remove`

## Worlds and players
- `worlds.list`, `worlds.create`
- `players.kick`, `players.ban`, `players.whitelist`
- `players.op`, `players.deop`, `players.gamemode`, `players.give`

## Configuration and diagnostics
- `config.server_properties.read`
- `config.server_properties.set`
- `config.server_properties.validate`
- `diagnostics.recent_console`

## Backups
- `backups.create` — copy server files to a sibling backup directory
- `backups.list`

## Risk model
- Safe: read-only inspection.
- Moderate: player actions and routine operational changes.
- Destructive: server lifecycle changes, config writes, plugin installation, backup creation.
- Critical: file deletion.

The local runtime requires explicit approval for mutating tools unless the caller is in dry-run mode. Filesystem paths are resolved against the configured server root. The process manager uses `shell:false` and does not expose a generic operating-system shell.

## Known limitations
The first runtime does not yet implement a remote control-plane connection, automatic rollback, restore-from-backup, TPS sampling, full player enumeration, or Spigot installation. Those require additional provider and transport work; the UI must not imply that they are already operational.
