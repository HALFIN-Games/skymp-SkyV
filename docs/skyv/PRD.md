## Product Requirements Document (PRD)

### 1. Summary

SkyV is a “launcher + server framework + ecosystem” for **Skyrim Special Edition** that enables large, persistent roleplay servers with FiveM-like features (organisations, minigames, custom progression, custom crafting/recipes, moderation), adapted to Skyrim.

The technical foundation is expected to be a **fork and/or distribution built on SkyMP**, with additional services and tooling.

### 2. Goals (MVP)

The MVP must enable a community to run a server and for a player to join it with minimal friction.

Key goals:

- Players can discover servers in a **server browser** and join with one click.
- Servers can define a **versioned server pack** (framework + mods + configs) that the launcher installs/updates.
- Servers can run a **scriptable gamemode/framework** for RP systems (TypeScript/Papyrus aligned with SkyMP).
- Servers can enforce **accounts, bans, roles, and permissions**.
- Players have **true positional/proximity voice** integrated into the game experience (PTT, attenuation, spatialisation).
- Scales towards **200–500 total slots**, with a design target of **~100 concurrent players in a single town area**, assuming spread across streets and instanced interiors (not 100 in one tight scene).

### 3. Non-goals (initially)

- Perfect replication of every Skyrim single-player mechanic.
- “500 players in the same room” events.
- Redistributing Bethesda assets.
- Bundling third-party mods in ways that violate authors’ permissions.
- Full anti-cheat parity with modern competitive games (we will implement pragmatic server authority and sanity checks).

### 4. Target users

- **Players**: want fast onboarding, stable RP, integrated voice, and “it just works” joining.
- **Server owners/admins**: want a reliable server bundle, scripting, moderation tools, and an update pipeline.
- **Content developers**: want a clear API and packaging model for resources/gamemodes.

### 5. Assumptions and constraints

- Players must **own Skyrim SE on Steam** (entitlement verified via launcher).
- Windows-first (matching Skyrim modding ecosystem).
- Community self-hosted servers for MVP.
- “Users can add visual-only mods” is allowed, but must be isolated from the **server-required pack** to reduce support burden.

### 6. Core user journeys

#### Player: install and join

1. Install Skyrim SE via Steam.
2. Install SkyV launcher.
3. Log in (SkyV account).
4. Choose a server, click **Join**.
5. Launcher installs/updates the server-required pack, verifies integrity, launches the game, and connects.

#### Server owner: create and publish a server

1. Download server bundle (SkyMP-based) + SkyV server runtime.
2. Configure server settings, ports, and server-required pack.
3. Start server, register it to the directory, appears in server browser.
4. Publish updates via versioned manifests.

### 7. MVP feature set (definition of done)

Functional features:

- Server browser (name, description, ping, player count, version).
- Join flow with pack download/verification/launch.
- Account login + token issuance.
- Server-side roles/ACL + ban list.
- Scriptable server “resource” system with at least:
  - a command system (`/help`, `/me`)
  - a simple organisation example (join/leave a faction)
  - persistence for one system (e.g., money, reputation, or org membership)
- Positional voice MVP:
  - push-to-talk
  - proximity attenuation + spatialisation
  - interior separation (no street/interior bleed)
  - per-listener audibility cap (avoid “100 talkers” chaos)

Operational features:

- Versioned manifests for packs (hashes, sizes, dependencies).
- Crash/log collection path documented for support.

### 8. KPIs / success signals

- Time-to-first-join (fresh install) under 10 minutes on a typical connection.
- Join success rate > 95% (after first pack download).
- In a 60–100 player town test, average client FPS and crash rate within acceptable thresholds (to be defined during spike).
- Voice remains intelligible in crowded areas (measured by subjective testing and audibility/mixing constraints).

