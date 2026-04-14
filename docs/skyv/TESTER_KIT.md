## Tester kit (pre-launcher)

This document defines what to package and how a remote tester should install it.

The goal is a repeatable, minimal client setup that matches the known-good baseline.

---

## 1) What the tester needs

- Steam: “Skyrim Special Edition” installed
- Skyrim runtime: `1.6.1170`
- SKSE: `2.2.6` for runtime `1.6.1170`
- Tailscale installed (only needed when the tester is ready to connect remotely)

---

## 2) What we provide (the kit)

Create a folder (or zip) containing:

- `client/Data/` — the SkyMP client `Data` payload (copied from your SkyMP build output)
- `docs/` — include:
  - `SKYMP_LOCAL_RUN_GUIDE.md`
  - `TESTER_SETUP_GUIDE.md`
  - `BASELINE_SNAPSHOT.md`

Keep this kit free of unrelated mods.

---

## 3) Build the kit (host machine)

PowerShell example (creates a local staging folder). Update `$skyvRoot` and `$clientSrc` for your machine.

```powershell
$skyvRoot = "C:\Users\t\Documents\Github\skymp-SkyV"
$kitRoot = "$skyvRoot\staging\skyv-tester-kit"

$clientSrc = "$skyvRoot\external\skymp\build\dist\client\Data"
$docsSrc = "$skyvRoot\docs\skyv"

Remove-Item -Recurse -Force $kitRoot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$kitRoot\client\Data" | Out-Null
New-Item -ItemType Directory -Force -Path "$kitRoot\docs" | Out-Null

robocopy $clientSrc "$kitRoot\client\Data" /E /R:1 /W:1

Copy-Item -Force "$docsSrc\SKYMP_LOCAL_RUN_GUIDE.md" "$kitRoot\docs"
Copy-Item -Force "$docsSrc\TESTER_SETUP_GUIDE.md" "$kitRoot\docs"
Copy-Item -Force "$docsSrc\BASELINE_SNAPSHOT.md" "$kitRoot\docs"
```

Optional: zip it:

```powershell
$zipPath = "$skyvRoot\staging\skyv-tester-kit.zip"
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Compress-Archive -Path "$kitRoot\*" -DestinationPath $zipPath
```

---

## 4) Tester install steps (summary)

1. Install Skyrim SE via Steam.
2. Launch once from Steam, then quit.
3. Install SKSE into the Skyrim root folder and verify logs exist.
4. Copy `client\\Data\\*` from the kit into Skyrim `Data\\`.
5. Ensure only SkyMP plugins are enabled in `Data\\SKSE\\Plugins`.
6. Set the server IP/port in:
   - `<SkyrimRoot>\\Data\\Platform\\Plugins\\skymp5-client-settings.txt`

   Example:

   ```json
   {
     "server-ip": "16.16.122.192",
     "server-port": 7777,
     "server-info-ignore": true
   }
   ```
7. Launch via `skse64_loader.exe`.
8. Connect.
