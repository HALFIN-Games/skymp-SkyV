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
