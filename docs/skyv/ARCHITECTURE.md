## Technical Architecture (draft)

### 1. Guiding principles

- **Ship by validation**: prove SkyMP extension points and performance before committing to large custom layers.
- **Server-authoritative where it matters**: economy, progression, permissions, crafting outcomes.
- **Graduated fidelity**: interest management tiers are mandatory for “100 in a town” stability.
- **Separate concerns**: game sync, RP framework, content distribution, and voice are distinct subsystems.

### 2. High-level components

SkyV is composed of:

- **Game multiplayer foundation**: SkyMP-based client and dedicated server.
- **SkyV Server Runtime** (our layer): RP framework, scripting resources, permissions, persistence, server registration, metrics.
- **SkyV Launcher** (our product): login, server browser, pack installation, updates, launch/connect, voice bootstrap.
- **SkyV Backend** (our services): auth, server directory, pack manifests, moderation APIs.
- **Voice subsystem** (self-hosted): routing + transport + client mixing/spatialisation.

SkyMP reference: the project describes server-controlled game state, customisation via TypeScript/Papyrus scripting, and the requirement that client/server load order match for esp/esm mods.
Source: https://github.com/skyrim-multiplayer/skymp

### 3. Hosting model (MVP)

Community self-hosted:

- Server owners run:
  - SkyMP server + SkyV server runtime (same machine initially)
  - Optional: voice relay node (or central voice cluster operated by us)
  - Database (local SQLite for MVP; optional external DB)
- SkyV operates:
  - Auth + directory + manifests + CDN (initially minimal)

### 4. Data flows (player join)

1. Launcher authenticates to backend, receives access token.
2. Launcher fetches server list and selected server’s pack manifest.
3. Launcher installs/updates server-required pack into an isolated “profile” folder.
4. Launcher starts voice client service (if not running) and hands it auth + server identity.
5. Launcher starts the game client with required loaders/config and connect parameters.
6. Client connects to SkyMP server; server validates:
   - framework version
   - pack version/hash
   - account token / ban status / role

### 5. Interest management (required for 100-player towns)

We enforce per-player replication budgets. A suggested first cut:

- **Tier A (near)**: 0–25m, max 20–30 entities, high update rate
- **Tier B (mid)**: 25–80m, capped entities, reduced update rate + reduced detail
- **Tier C (far)**: presence-only, very low update rate / no combat

This is implemented server-side as a “who gets what” filter and budget allocator, and client-side as rendering/animation simplification where possible.

### 6. Interiors instancing model (your chosen strategy)

- Every interior is an instance keyed by:
  - interior/cell identifier
  - party/session identifier (so groups enter together)
- Voice scoping follows the same boundaries:
  - interior ↔ street is strongly attenuated or blocked
  - interior ↔ interior is isolated unless intentionally connected (e.g., “radio/magic channel”)

### 7. Voice architecture (self-hosted WebRTC/Opus)

Design goal: true positional voice that stays intelligible in crowds.

Approach:

- **Voice Router** (server):
  - receives player positions, orientation, and “space id” (street vs interior instance)
  - computes audibility graph (distance, space boundaries, whisper/shout modes)
  - enforces an **audibility budget** per listener (mix N nearest/loudest)
- **Voice Transport**:
  - WebRTC for NAT traversal and low latency, with Opus codec
  - may be SFU-like (selective forwarding) rather than full mixing
- **Client Voice Module**:
  - spatialises received streams locally (HRTF/panning), applies attenuation
  - integrates PTT + HUD via game-side plugin

### 8. Pack / mod distribution

We separate content into:

- **Server-required pack**: required mods/config/framework; fully managed by launcher; hash-verified.
- **User overlay**: optional visual-only mods, not supported by servers; can be permitted with guardrails.

Manifests include:

- version, dependency graph
- file list with hashes and sizes
- optional “source” pointers for third-party mods (respect permissions)

### 9. Security / trust boundaries (MVP)

- All “important” game economy/progression decisions are server-side.
- Client is treated as untrusted (sanity checks, rate limiting, replay protection where feasible).
- Tokens are short-lived; server validates with backend or signed JWT (decision later).
- Server operators are not fully trusted; we assume they can modify their servers, but directory policies can enforce minimum versions and ban evasion controls.

### 10. What we build first (vertical slice)

- Minimal launcher that can:
  - authenticate, list servers, download a tiny pack, launch, connect
- A minimal SkyV server runtime that can:
  - register server, load one resource, enforce a ban list
- Voice MVP that can:
  - connect, route proximity audio, and spatialise locally

