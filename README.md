# Yazoni Plugin Downloader

A deliberately simple Minecraft plugin installer.

- Search **Modrinth** plugins.
- Search **Spigot** resources through Spiget.
- Click **Install** and the server downloads the JAR and puts it directly in the server's `plugins/` directory over EternalZero SFTP.
- No Gemini, AI agent, control plane, server console, backups, worlds, player tools, or other server-management features.

Required Render environment variables:

- ETERNALZERO_SFTP_HOST
- ETERNALZERO_SFTP_PORT (usually 2022)
- ETERNALZERO_SFTP_USERNAME
- ETERNALZERO_SFTP_PASSWORD
- ETERNALZERO_SFTP_ROOT
- ADMIN_PASSWORD

Modrinth's API provides project search and version file URLs. Spiget provides a JSON API for Spigot resources and downloads. 
