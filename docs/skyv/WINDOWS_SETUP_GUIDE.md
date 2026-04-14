## Windows setup guide (for Trae AI)

### Purpose

Set up a Windows PC so we can **build, run, and modify SkyMP** (Skyrim Special Edition multiplayer foundation) as the first technical spike for SkyV.

This guide is written as a step-by-step checklist for an assistant to follow. Where the outcome is uncertain (e.g., a build error), capture logs and report back rather than guessing.

### Scope

This covers:

- Installing all required build tools and runtimes
- Installing Skyrim Special Edition via Steam (required to run the client)
- Cloning and building SkyMP (baseline and an RP fork)
- Preparing to run a local server and connect a client

It does **not** yet cover:

- Building the SkyV launcher
- Building the full voice system (WebRTC/Opus) beyond prerequisites

---

## A. Machine prerequisites

### A1) Recommended PC spec (baseline for dev)

Minimum for initial builds:

- Windows 10 or 11 (64-bit), fully updated
- 16 GB RAM (32 GB recommended)
- 50–100 GB free disk space (build artefacts + Skyrim install)
- Stable internet connection

Record and report:

- CPU model
- RAM amount
- GPU model
- Free disk space

### A2) Windows configuration

1. Enable long paths (recommended):
   - Open **Local Group Policy Editor** → *Local Computer Policy* → *Computer Configuration* → *Administrative Templates* → *System* → *Filesystem* → **Enable Win32 long paths** = Enabled
   - If not available, use registry:
     - `HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem`
     - `LongPathsEnabled` (DWORD) = `1`

2. Reboot after enabling long paths.

---

## B. Install core tooling

### B1) Git

Install Git for Windows:

- https://git-scm.com/download/win

During install:

- Prefer “Git from the command line and also from 3rd-party software”
- Prefer “Checkout Windows-style, commit Unix-style line endings” (default is usually fine)

Verify in PowerShell:

- `git --version`

### B2) Visual Studio 2022 (Build Tools)

Install Visual Studio 2022 Community (or Build Tools if you prefer headless):

- https://visualstudio.microsoft.com/vs/

In the installer, ensure these workloads/components are selected:

- **Desktop development with C++**
- **Windows 10/11 SDK** (latest available)
- **C++ CMake tools for Windows**
- **MSVC v143** toolset

After install, reboot if prompted.

### B3) CMake (if not already installed via VS)

If `cmake --version` does not work after VS install, install CMake:

- https://cmake.org/download/

Choose the Windows x64 installer and enable “Add CMake to the system PATH”.

Verify:

- `cmake --version`

### B4) Node.js (LTS)

Install Node.js LTS:

- https://nodejs.org/en/download

Verify:

- `node -v`
- `npm -v`

### B5) Python (recommended for scripting and tooling)

Install Python 3.12+:

- https://www.python.org/downloads/windows/

During install tick:

- “Add python.exe to PATH”

Verify:

- `python --version`

### B6) vcpkg

SkyMP uses vcpkg as part of its build system (it may be included as a submodule). If SkyMP includes vcpkg in-repo, follow their build instructions; otherwise install a standalone vcpkg:

- https://github.com/microsoft/vcpkg

If installing standalone:

1. Clone: `git clone https://github.com/microsoft/vcpkg`
2. Bootstrap: run `bootstrap-vcpkg.bat`
3. Integrate (optional): `vcpkg integrate install`

### B7) Microsoft Visual C++ Redistributable (x64)

Install the latest Visual C++ 2015–2022 redistributable:

- https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist

---

## C. Install Skyrim Special Edition (Steam)

### C1) Steam

Install Steam:

- https://store.steampowered.com/about/

### C2) Skyrim Special Edition

In Steam, install:

- “The Elder Scrolls V: Skyrim Special Edition”

After install:

1. Launch the game once from Steam to complete first-run setup.
2. Record the install path (e.g., `C:\\Program Files (x86)\\Steam\\steamapps\\common\\Skyrim Special Edition\\`).

Notes:

- We are not redistributing Bethesda assets; owning the game is mandatory.

---

## D. Clone the repositories we will evaluate

Create a working directory, e.g.:

- `C:\\dev\\skyv\\`

### D1) Upstream SkyMP

Clone:

- `git clone https://github.com/skyrim-multiplayer/skymp.git`

### D2) Skyrim Roleplay fork (claims 650 slots)

Clone:

- `git clone https://github.com/skyrim-roleplay/skymp.git skymp-sr`

### D3) Optional: NirnLab UI Platform (in-game CEF UI)

Clone:

- `git clone https://github.com/skyrim-roleplay/NirnLabUIPlatform.git`

This project advertises a CEF-based UI platform usable as an SKSE plugin. It may be useful for RP HUD/menus.
Source: https://github.com/skyrim-roleplay/NirnLabUIPlatform

### D4) Optional: ied-dev

Clone:

- `git clone https://github.com/skyrim-roleplay/ied-dev.git`

This appears to be Immersive Equipment Displays (a mod/dev fork) and is likely not required for the SkyMP spike, but it may be part of their broader server/client mod stack.
Source: https://github.com/skyrim-roleplay/ied-dev

---

## E. Build SkyMP (technical spike)

Important: **Prefer the repository’s own CONTRIBUTING/build instructions** if available. If a command differs from this guide, follow the repository docs.

### E1) Read SkyMP build instructions

In each cloned repo:

1. Open `CONTRIBUTING.md` (if present).
2. Open `README.md`.
3. Note required versions of:
   - CMake
   - Node
   - vcpkg
   - Visual Studio / MSVC toolset

If anything is ambiguous, capture the line(s) and report back.

### E2) Attempt build (upstream first)

From a “Developer PowerShell for VS 2022” prompt:

1. `cd C:\\dev\\skyv\\skymp`
2. If the repo uses submodules:
   - `git submodule update --init --recursive`
3. Run the official build steps (from their docs).

If no clear build steps exist, try their `build.sh` for reference (even on Windows it often documents the flow). Do **not** force Linux steps onto Windows; report back and ask for the Windows equivalent.

### E3) Build the Skyrim Roleplay fork

Repeat the same steps for:

- `C:\\dev\\skyv\\skymp-sr`

Record:

- Whether it builds more easily or has extra patches
- Any configuration defaults that look “high slot” related

### E4) If the build fails

Do not keep changing random things. Instead collect:

- Full terminal output (copy/paste)
- The first error line and the last 100 lines of output
- Any referenced missing files or packages

Then report back so we can diagnose and adjust the instructions precisely.

---

## F. Run a local server + connect a client (minimum validation)

### F1) Identify server executable and config

From the build output, find:

- server binary/executable name
- default config file(s)
- required ports (TCP/UDP)

Capture those paths and filenames.

### F2) Firewall

Allow the server executable through Windows Firewall (private network).

### F3) Start server

Start the server and confirm:

- it binds to the expected port
- it prints “ready”/listening logs

Save the server log output.

### F4) Start client

Follow SkyMP client setup instructions. This typically involves a mod/plugin installation into Skyrim’s Data/SKSE structure (depending on their approach).

Key outcome:

- Connect one client to localhost server.
- Then connect a second client (can be the same machine if supported).

Capture:

- connection success/failure logs
- any crash dumps or error dialogs

---

## G. What to report back (copy/paste)

When finished (or blocked), report back with:

- Windows version
- CPU/RAM/GPU
- Skyrim SE install path
- Upstream SkyMP build result (success/failure) + logs
- SR fork build result (success/failure) + logs
- Whether server starts (yes/no) + ports + server logs
- Whether a client connects (yes/no) + client logs

---

## H. Useful reference links (for quick access)

SkyMP upstream:

- https://github.com/skyrim-multiplayer/skymp

Skyrim Roleplay fork (claimed 650 slots):

- https://github.com/skyrim-roleplay/skymp

NirnLab UI Platform (CEF UI, SKSE plugin approach):

- https://github.com/skyrim-roleplay/NirnLabUIPlatform

Microsoft toolchain links:

- Visual Studio: https://visualstudio.microsoft.com/vs/
- CMake: https://cmake.org/download/
- Git: https://git-scm.com/download/win
- Node.js: https://nodejs.org/en/download
- Python: https://www.python.org/downloads/windows/
- VC++ Redistributable: https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist

