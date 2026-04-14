## Remote tester setup guide (SkyMP spike)

This guide documents a repeatable setup for:

- Host PC (you): builds and runs the server.
- Tester PC (remote): installs the client and connects over a private VPN (Tailscale).

This avoids router port forwarding.

---

## 1) Shared prerequisites

- Windows 10/11 x64
- Steam install of “Skyrim Special Edition”
- Skyrim runtime version: `1.6.1170`
- SKSE version: `2.2.6` (for runtime `1.6.1170`)

Notes:

- The “AE build” naming refers to the runtime branch; it is still used with Steam Skyrim Special Edition when the runtime is `1.6.x`.

---

## 2) Host PC (server) setup

### 2.1 Paths (update for your machine)

- Skyrim root: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\`
- SkyMP server folder: `...\external\skymp\build\dist\server\`
- SkyMP client folder: `...\external\skymp\build\dist\client\Data\`

### 2.2 Start the server

PowerShell:

```powershell
$skympRepo = "C:\Users\t\Documents\Github\skymp-SkyV\external\skymp"
cd "$skympRepo\build\dist\server"
& "C:\Program Files\nodejs\node.exe" .\dist_back\skymp5-server.js
```

Expected log includes:

- `Server resources folder is listening on 3000`

Default ports:

- UDP `7777` (client connects to this)

### 2.3 Clean server world (optional)

To start with an empty server state, stop the server and move `world*` out of the server folder before restarting.

---

## 3) Tester PC (client) setup

### 3.1 Install Skyrim and verify runtime

1. Install Skyrim SE in Steam.
2. Launch once from Steam, then quit.
3. Confirm `SkyrimSE.exe` file version is `1.6.1170`.

### 3.2 Install SKSE (2.2.6)

Install SKSE into the Skyrim root folder (same folder as `SkyrimSE.exe`), and copy scripts into `Data\\Scripts`.

Launch the game using:

- `skse64_loader.exe`

Verify logs exist at:

- `%USERPROFILE%\\Documents\\My Games\\Skyrim Special Edition\\SKSE\\`

### 3.3 Install SkyMP client files

Copy the provided SkyMP client `Data\\` contents into Skyrim `Data\\`.

After copy, confirm these exist:

- `Data\\SKSE\\Plugins\\SkyrimPlatform.dll`
- `Data\\SKSE\\Plugins\\MpClientPlugin.dll`
- `Data\\Platform\\Plugins\\skymp5-client.js`

### 3.4 Set the server IP/port

The client reads its connection target from:

- `<SkyrimRoot>\\Data\\Platform\\Plugins\\skymp5-client-settings.txt`

Edit that file and set:

- `server-ip`: server public IPv4 (or DNS)
- `server-port`: `7777`

Example:

```json
{
  "server-ip": "16.16.122.192",
  "server-port": 7777,
  "server-info-ignore": true
}
```

`server-info-ignore: true` forces direct connect and avoids any gateway/server-info lookup.

### 3.5 Keep the tester environment clean

For the spike, disable all non-SkyMP SKSE plugins. Only these should remain in `Data\\SKSE\\Plugins`:

- `SkyrimPlatform.dll`
- `MpClientPlugin.dll`

---

## 4) Remote connection over Tailscale

### 4.1 Install Tailscale on both PCs

1. Install Tailscale on the host PC and tester PC.
2. Sign in on both PCs.
3. Confirm both devices appear in the Tailscale admin/devices list.

### 4.2 Connect to the server

1. On the host PC, note the host’s Tailscale IP (typically `100.x.y.z`).
2. Tester connects to:

- `<host_tailscale_ip>:7777`

Example:

- `100.64.12.34:7777`

### 4.3 Firewall

If the tester can’t connect, allow inbound UDP `7777` on the host PC for Private networks.

---

## 5) Validation checklist

### 5.1 Server-side

- Server logs show `connect` for the tester.
- Server logs show character load/create.

### 5.2 Client-side

- Client can connect and load into the world.
- Basic actions work (movement, doors, containers).
- Quit and reconnect works.

---

## 6) Troubleshooting

- Black screen after launching via SKSE usually indicates a conflicting SKSE plugin; keep `Data\\SKSE\\Plugins` minimal.
- If “single player” appears to resume multiplayer state, ensure a clean profile in `Documents\\My Games\\Skyrim Special Edition\\`.
