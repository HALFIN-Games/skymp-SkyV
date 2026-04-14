## Baseline snapshot (known-good SkyMP spike)

This document records the exact versions, paths, and settings used for a known-good run where:

- server starts
- client connects
- inventory/world state persists across game exit and server restart

---

## 1) Versions

- Skyrim runtime: `1.6.1170`
- SKSE: `2.2.6` (for runtime `1.6.1170`)
- Node: `v24.14.1`
- Git: `2.53.0.windows.2`
- CMake: `4.3.1`

SkyMP repositories (local clones, not committed to this repo):

- Upstream SkyMP commit: `aa22bf2d`
- Skyrim Roleplay fork commit: `5de4aa86`

---

## 2) Paths (this machine)

These paths are examples from the baseline machine; if you keep your SkyMP clones elsewhere, update the paths but keep the structure consistent.

- Repo root (this repo): `C:\Users\t\Documents\Github\skymp-SkyV\`
- SkyMP upstream clone: `C:\Users\t\Documents\Github\skymp-SkyV\external\skymp\`
- SkyMP SR clone: `C:\Users\t\Documents\Github\skymp-SkyV\external\skymp-sr\`

Skyrim install:

- Skyrim root: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\`

SkyMP artifacts (upstream):

- Server folder: `...\external\skymp\build\dist\server\`
- Client folder (Data payload): `...\external\skymp\build\dist\client\Data\`

SKSE logs:

- `%USERPROFILE%\Documents\My Games\Skyrim Special Edition\SKSE\`

---

## 3) Server configuration (upstream)

File:

- `external\skymp\build\dist\server\server-settings.json`

Notable settings:

- `offlineMode: true`
- `port: 7777` (UDP)
- `npcEnabled: false` (NPCs disabled)
- `loadOrder`: vanilla masters only

---

## 4) Client configuration policy

For stability during the spike:

- Keep `Data\\SKSE\\Plugins` minimal
- Only required SkyMP client plugins should be enabled:
  - `SkyrimPlatform.dll`
  - `MpClientPlugin.dll`

---

## 5) Run commands

### 5.1 Start server

PowerShell:

```powershell
cd "C:\Users\t\Documents\Github\skymp-SkyV\external\skymp\build\dist\server"
& "C:\Program Files\nodejs\node.exe" .\dist_back\skymp5-server.js
```

Expected server log includes:

- `Server resources folder is listening on 3000`

### 5.2 Launch client

Launch via:

- `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\skse64_loader.exe`

Connect to:

- `127.0.0.1:7777`

---

## 6) Success criteria (“what good looks like”)

- Server prints a successful connect sequence (assign guid, connect, load character).
- Client loads into world with no hard failures.
- Persistence test passes:
  - pick up items / move items into container
  - exit game
  - restart server
  - reconnect
  - items and position persist

---

## 7) Notes / known behavior

- NPCs are disabled by default (`npcEnabled: false`). This is expected for the current baseline.
- The server will log master server URLs (gateway.skymp.net) even in offline mode; this is normal.

