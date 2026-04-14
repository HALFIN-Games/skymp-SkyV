## SkyMP local run guide (Windows)

This is a quick, practical checklist to run a local SkyMP server and connect a client on the same machine.

Update these two paths for your machine:

- `$skympRepo = "C:\Users\t\Documents\Github\skymp-SkyV\external\skymp"`
- `$skyrimRoot = "C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition"`

---

## 0) After a fresh Skyrim reinstall

1. Install Skyrim SE in Steam.
2. Launch once from Steam (first-run setup).
3. Install SKSE matching your Skyrim runtime version.
4. Copy SkyMP client files into the game (see “Client install”).

---

## 1) Start the server (upstream build)

### 1.1 Go to the server folder

PowerShell:

```powershell
cd "$skympRepo\build\dist\server"
```

### 1.2 Ensure the 5 master ESMs exist in the server `data\\` folder

The server expects to read these files from `build\\dist\\server\\data\\`:

- `Skyrim.esm`
- `Update.esm`
- `Dawnguard.esm`
- `HearthFires.esm`
- `Dragonborn.esm`

Copy them from your Skyrim install:

```powershell
$src = "$skyrimRoot\Data"
$dst = "$skympRepo\build\dist\server\data"

New-Item -ItemType Directory -Force -Path $dst | Out-Null

Copy-Item -Force "$src\Skyrim.esm"      $dst
Copy-Item -Force "$src\Update.esm"      $dst
Copy-Item -Force "$src\Dawnguard.esm"   $dst
Copy-Item -Force "$src\HearthFires.esm" $dst
Copy-Item -Force "$src\Dragonborn.esm"  $dst
```

Verify:

```powershell
dir "$dst\Skyrim.esm","$dst\Update.esm","$dst\Dawnguard.esm","$dst\HearthFires.esm","$dst\Dragonborn.esm"
```

### 1.3 Start the server

If `node` is not on your PATH, use the full path:

```powershell
cd "$skympRepo\build\dist\server"
& "C:\Program Files\nodejs\node.exe" .\dist_back\skymp5-server.js
```

Expected log includes:

- `Server resources folder is listening on 3000`

Default ports:

- UDP `7777` (game traffic)
- TCP `3000` (server resources folder)

Stop the server with `Ctrl+C`.

---

## 2) Install the client into Skyrim

Copy everything under the built client `Data\\` into the game `Data\\`:

- Source: `$skympRepo\build\dist\client\Data\`
- Destination: `$skyrimRoot\Data\`

If you prefer command line (Admin PowerShell recommended):

```powershell
$src = "$skympRepo\build\dist\client\Data"
$dst = "$skyrimRoot\Data"
robocopy $src $dst /E /R:1 /W:1
```

### 2.1 Verify key files exist

```powershell
$skyrimData = "$skyrimRoot\Data"

Test-Path "$skyrimData\SKSE\Plugins\SkyrimPlatform.dll"
Test-Path "$skyrimData\SKSE\Plugins\MpClientPlugin.dll"
Test-Path "$skyrimData\Platform\Plugins\skymp5-client.js"
```

All should be `True`.

---

## 3) Run the client and connect

1. Ensure the server is still running.
2. Launch:
   - `$skyrimRoot\skse64_loader.exe`
3. Point the client at your server (IP/port).

SkyMP reads connection settings from:

- `<SkyrimRoot>\Data\Platform\Plugins\skymp5-client-settings.txt`

Edit the JSON in that file to set:

- `server-ip`
- `server-port`

Example (VPS):

```json
{
  "server-ip": "16.16.122.192",
  "server-port": 7777,
  "server-info-ignore": true
}
```

`server-info-ignore: true` forces direct connect and avoids any gateway/server-info lookup.

For local testing, use:

- `127.0.0.1:7777`

If you see logs like:

- `Handle connection accepted`
- `Create actor`
- `WorldView: Update is now allowed`

…then you are connected.

---

## 4) Common gotchas

### Running commands from the wrong folder

If you run commands from the repo root, relative paths like `./dist_back/...` won’t work.
Always `cd` into `build\\dist\\server` first.

### Node not found

Use `& "C:\Program Files\nodejs\node.exe" ...` to bypass PATH issues.

### Load order mismatch (modded client)

SkyMP expects client and server load order to match. For a clean spike, run a vanilla-only client (only the 5 masters enabled) before trying modded setups.
