## EC2 deployment guide (SkyMP spike)

This guide defines a repeatable, pinned deployment workflow for running the SkyMP server on an AWS EC2 Ubuntu instance.

Goal:

- Avoid copying build artifacts between Windows and Linux.
- Pin the deployed SkyMP commit so upgrades are deliberate and reversible.

---

## 1) AWS prerequisites

- EC2 instance: Ubuntu 22.04 x86_64
- Security group inbound:
  - TCP `22` (SSH) from your IP (or temporarily `0.0.0.0/0` while setting up)
  - UDP `7777` (SkyMP server port) from `0.0.0.0/0` (or restrict to testers later)
- Optional: Elastic IP to keep the server address stable.

---

## 2) Source-of-truth policy

Treat these as authoritative:

- SkyMP git commit hash (pinned)
- `server-settings.json` checked into this repo (template)
- A small deployment record: region, instance type, public IP/DNS, and the pinned commit

Do not treat these as authoritative:

- `build/dist/...` copied from a different OS

---

## 3) Pin the deployed SkyMP commit

Use the baseline commit from `BASELINE_SNAPSHOT.md` unless you intentionally upgrade.

On the EC2 instance:

```bash
cd ~
git clone https://github.com/skyrim-multiplayer/skymp.git
cd skymp
git submodule update --init --recursive

# Pin to known-good baseline (example)
git checkout aa22bf2d
git submodule update --init --recursive
```

When upgrading:

- change the pinned commit
- rebuild
- restart service
- if anything breaks, revert by checking out the previous commit

---

## 4) Install dependencies (Ubuntu 22.04)

```bash
sudo apt update
sudo apt install -y git python3 ninja-build pkg-config build-essential curl ca-certificates
sudo apt install -y clang-15 lld-15
sudo apt install -y cmake

# Node (recommended: 18.x LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

---

## 5) Build the Linux server

SkyMP includes a wrapper to reduce dependency issues on Linux.

```bash
cd ~/skymp
./build.sh --configure -DCMAKE_BUILD_TYPE=Release
cd build
../build.sh --build --parallel 2
```

If the build runs out of memory, add swap before rebuilding.

---

## 6) Copy server config + master files

### 6.1 Server config

Use the repo-owned template as the starting point:

- `infra/skymp/server-settings.json`

Copy it onto the server as:

- `~/skymp/build/dist/server/server-settings.json`

### 6.2 Master files

The server expects vanilla master files to exist in the server `data` dir.

Required:

- `Skyrim.esm`
- `Update.esm`
- `Dawnguard.esm`
- `HearthFires.esm`
- `Dragonborn.esm`

Place them in:

- `~/skymp/build/dist/server/data/`

---

## 7) Run

```bash
cd ~/skymp/build/dist/server
node dist_back/skymp5-server.js
```

---

## 8) Ops notes

- Prefer a systemd service for always-on operation (restart on crash).
- Resizing EC2 instance types usually requires a stop/start.
- If testers are remote, use the instance public IPv4 (or Elastic IP):
  - `<public_ip>:7777`

