## Vokun RP v0 (feature notes)

This document captures the initial Vokun RP feature requirements so SkyV planning and implementation stays aligned.

---

## 0) Loader application (future)

We need a downloadable “loader” application for players.

Scope to define separately:

- install/update the server-required pack
- manage clean profiles
- launch SKSE with the correct parameters
- connect reliably and collect logs

Security note:

- During active development, server settings may be committed for convenience.
- Before production, move machine-specific values and secrets into `server-settings.local.json` (not committed) and keep `server-settings.json` as a safe baseline.

---

## 1) Join flow (character-first)

### 1.1 Character selection

When the game starts, the player should see a character UI instead of immediately loading into a character.

Capabilities:

- list characters
- select a character and join
- create a new character
- delete a character (soft delete)

Limits:

- regular players: 5 character slots
- admins: 10 character slots

Persistence:

- per-account list of characters + metadata
- per-character state (appearance/race, inventory, position, org membership, gold ledger)

### 1.2 First-time rules acknowledgement

When a player creates their first ever character, show a rules/info UI and require acknowledgement before allowing play.

Persistence:

- per-account `hasAcknowledgedRules` flag

### 1.3 Queue on full server

Join should only be attempted after the player selects (or creates) a character.

If the server is full:

- the player enters a queue
- when a slot becomes available, they are admitted

Persistence:

- queue state does not need to persist across server restarts

### 1.4 Player identity (Discord-linked)

We need a stable, cross-session identity to:

- decide the character slot limit (5 vs 10)
- decide reserved slot access
- decide queue priority
- support later whitelist approvals

Identity source of truth:

- Discord account (`discord_id`)

Server-side data (per account):

- `discord_id`
- cached Discord role ids (optional)
- derived `player_type` (e.g., `admin`, `member`, `guest`)
- `hasAcknowledgedRules`

Role mapping (configurable):

- Discord role “Admin” -> `player_type=admin`
  - 10 character slots
  - can occupy reserved slots
  - higher queue priority
- Discord role “Member” -> `player_type=member`
  - 5 character slots
  - normal queue priority
- No required role -> `player_type=guest` (optional)
  - minimal/limited access (optional)

### 1.5 Discord auth (OAuth2)

Auth goals:

- server can prove the player owns a Discord identity
- server can read the player’s roles in the official Discord guild

Recommended OAuth scopes (Discord):

- `identify`
- `guilds.members.read` (preferred if available for the bot/app)

Flow:

1) Client opens a Discord OAuth URL and the user approves.
2) Discord redirects back with a short-lived `code`.
3) Server exchanges `code` for an access token.
4) Server fetches `discord_id` and guild roles.
5) Server maps roles -> `player_type`.

Caching:

- cache roles for a short TTL (e.g., 10 minutes)
- refresh on reconnect when stale

### 1.6 Reserved slots + queue priority

Server capacity model:

- `max_players`
- `reserved_slots`

Admission rules:

- admins (or role-configured privileged users) may occupy reserved slots
- everyone else can only occupy non-reserved slots

Queue priority (example):

- `admin`: priority 3
- `member`: priority 2
- `guest`: priority 1

Queue behavior:

- if server is full, the player enters the queue
- UI shows queue position (and optionally ETA later)
- player can cancel

### 1.7 Whitelist application system (later)

At a later stage we’ll add a whitelist application flow:

- player submits an application
- staff review and approve/deny
- on approval:
  - grant Discord role(s)
  - grant Discord channel permissions
  - update server account `player_type` (or rely on role mapping)

This should be designed so Discord remains the source of truth for access.

### 1.8 Implementation notes (current)

- Join UI entrypoint: **main menu**.
- Join UI theme color: `#0C2D24`.
- Client setting: `Data\\Platform\\Plugins\\skymp5-client-settings.txt` supports `"skyv-join-ui": true`.

---

## 2) Character state rules

### 2.1 Existing character load

When a slot is available, loading an existing character should spawn them where they last were.

### 2.2 New character template

New characters should start with:

- no armour / no inventory
- dressed in “ragged peasant clothing” (exact items to be confirmed)

### 2.3 New character first spawn

On the first load of any new character:

- spawn in a safe remote area
- grant starter kit:
  - 40 gold (integer)
  - 1 pickaxe
  - 1 woodcutting axe
  - ragged clothing (equipped)

Persistence + correctness requirements:

- starter kit must be idempotent (never double-grant on reconnect)
- gold grants must emit an auditable ledger entry
- inventory state must persist correctly across logout and server restart

---

## 3) Deletion policy

### 3.1 Soft delete (player-facing)

Character delete should be “soft delete” (recoverable/admin-auditable).

### 3.2 Hard delete (server-side maintenance)

Provide a server-side maintenance action to permanently purge soft-deleted characters (e.g., weekly, and/or older than N days).

---

## 4) Reserved slots policy

When the server reaches capacity, reserved slots should allow privileged groups to join.

Initial policy:

- 10% reserved for admins + “important RP roles” (e.g., Jarls)
- 10% reserved for creators (streamers, etc.)

Implementation note:

- simplest v0 rule: public players are capped at `maxPlayers - reservedTotal`, privileged roles can fill up to `maxPlayers`

---

## 5) Spawn location (Vokun RP region)

Target region:

- roughly between Shrine of Zenithar, Black-Briar Lodge, Broken Helm Hollow, and Shrine of Talos

How spawn points are defined:

- configure multiple `startPoints` in `server-settings.json`
- server chooses a random start point when creating a new character

How to capture a spawn point:

1. In Skyrim, go to the desired outdoor location.
2. Open console (`~`).
3. Run:
   - `player.getpos x`
   - `player.getpos y`
   - `player.getpos z`
   - `player.getangle z`
4. Add to server settings as:

```json
{
  "pos": [133857, -61130, 14662],
  "worldOrCell": "0x3c",
  "angleZ": 72
}
```

Notes:

- prefer flat terrain near roads to avoid spawning inside collision or on steep slopes
- use multiple points (3–5) and randomize among them
