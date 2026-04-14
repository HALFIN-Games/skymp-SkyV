## VPS server runbook (SkyV / SkyMP)

This is a copy-paste runbook for starting, stopping, verifying, and troubleshooting the SkyMP server on an Ubuntu VPS.

Assumptions:

- Repo: `/home/ubuntu/skyv`
- Server working dir: `/home/ubuntu/skyv/build/dist/server`
- Service name: `skyv-skymp.service`

Config model:

- `server-settings.json` is generated during build from the committed baseline `infra/skymp/server-settings.json`
- `server-settings.local.json` is optional, machine-specific overrides (recommended for VPS secrets/overrides)

---

## 1) Quick status

```bash
sudo systemctl status skyv-skymp.service --no-pager
```

Follow logs:

```bash
sudo journalctl -u skyv-skymp.service -f
```

---

## 2) Start / stop / restart

Start:

```bash
sudo systemctl start skyv-skymp.service
```

Stop:

```bash
sudo systemctl stop skyv-skymp.service
```

Restart:

```bash
sudo systemctl restart skyv-skymp.service
```

Enable on boot:

```bash
sudo systemctl enable skyv-skymp.service
```

Disable on boot:

```bash
sudo systemctl disable skyv-skymp.service
```

---

## 3) Verify ports

SkyMP game traffic:

- UDP `7777`

Server resources folder:

- TCP `3000`

Check listeners:

```bash
sudo ss -lunp | grep 7777 || echo "nothing listening on 7777"
sudo ss -ltnp | grep 3000 || echo "nothing listening on 3000"
```

---

## 4) “Server is down” checklist

1) Confirm service is running:

```bash
sudo systemctl status skyv-skymp.service --no-pager
```

2) Confirm UDP 7777 is listening:

```bash
sudo ss -lunp | grep 7777 || echo "nothing listening on 7777"
```

3) If the service is flapping (restarting), read the last error:

```bash
sudo journalctl -u skyv-skymp.service -n 200 --no-pager
```

---

## 5) “Address already in use” (error 98)

Symptom:

- `bind__() error 98`

Meaning:

- Another process is already bound to the port (usually because the server is already running via `systemd`, and you started a second instance manually).

Fix:

1) Do not run `node dist_back/skymp5-server.js` manually while `systemd` is running.
2) Restart the service instead:

```bash
sudo systemctl restart skyv-skymp.service
```

3) If you need to run it manually for debugging:

```bash
sudo systemctl stop skyv-skymp.service
cd /home/ubuntu/skyv/build/dist/server
node dist_back/skymp5-server.js
```

---

## 6) Force-kill everything (last resort)

This is the “nuclear option” if you think there are stuck processes.

```bash
sudo systemctl stop skyv-skymp.service

pkill -f skymp5-server.js || true
pkill -f scam_native.node || true

sudo ss -lunp | grep 7777 || echo "nothing listening on 7777"
```

Then start clean:

```bash
sudo systemctl start skyv-skymp.service
sudo systemctl status skyv-skymp.service --no-pager
```

---

## 7) Update + rebuild + restart

```bash
cd /home/ubuntu/skyv
git pull
git submodule update --init --recursive

./build.sh --configure -DCMAKE_BUILD_TYPE=Release
./build.sh --build --parallel 2

cp -f infra/skymp/server-settings.json build/dist/server/server-settings.json

# Optional: create/update local overrides (not committed)
cat > build/dist/server/server-settings.local.json <<'EOF'
{
  "name": "Vokun RP",
  "enableConsoleCommandsForAll": false
}
EOF

sudo systemctl restart skyv-skymp.service
sudo systemctl status skyv-skymp.service --no-pager
```

---

## 8) Back up server world (characters/persistence)

Server persistence is stored in `world*` files inside the server working directory.
Back up these files before risky changes.

```bash
sudo systemctl stop skyv-skymp.service

cd /home/ubuntu/skyv/build/dist/server

stamp=$(date +%F_%H%M%S)
mkdir -p backups/$stamp
cp -a world* backups/$stamp/ 2>/dev/null || true

sudo systemctl start skyv-skymp.service
sudo systemctl status skyv-skymp.service --no-pager
```

Verify backups:

```bash
ls -la /home/ubuntu/skyv/build/dist/server/backups | tail
```
