## Roadmap (draft)

This roadmap assumes 4–10 hours/week and a “validate early” approach. Dates are intentionally omitted; treat this as milestone sequencing.

### Milestone 0 — Baseline decisions and repo setup (1–2 sessions)

Outcomes:

- Architecture documents agreed (PRD, architecture, risks).
- Repo structure created (this folder).
- Decide: initial town (e.g., Whiterun), persistence choice (SQLite first), and initial voice routing rules.

### Milestone 1 — SkyMP technical spike (2–6 sessions)

Outcomes:

- Build and run SkyMP locally.
- Start a server and connect 1 client on a single dev PC.
- Produce an installable client package and instructions for a second tester.
- Connect 2+ clients once a second machine is available.
- Identify and document:
  - extension points for scripting/gamemodes
  - feasibility of interest management hooks
  - what “space id” we can reliably use for interiors vs exteriors
  - pack/load-order constraints in practice

Exit criteria:

- We can run a minimal custom gamemode script and persist one value per player.

### Milestone 2 — SkyV server runtime (framework core) (4–10 sessions)

Outcomes:

- A minimal “SkyV runtime” module that provides:
  - resource lifecycle (start/stop/reload)
  - permissions/roles
  - bans (local file first)
  - persistence adapter (SQLite)
  - server registration heartbeat to directory (stub allowed)

Exit criteria:

- Server can enforce a ban and run at least one resource-provided command.

### Milestone 3 — Launcher v0 (4–12 sessions)

Outcomes:

- Login (stub allowed), server browser (stub allowed), join flow.
- Pack manifest format defined; downloader + verifier implemented.
- Launch/connect orchestration works reliably for one server pack.

Exit criteria:

- Fresh machine can join the test server without manual mod steps.

### Milestone 4 — Voice MVP (4–12 sessions)

Outcomes:

- Voice router service with proximity rules and space scoping.
- Voice client service started by launcher.
- In-game integration for PTT/HUD (minimal).

Exit criteria:

- Two players can talk with positional audio and correct interior separation.

### Milestone 5 — “RP vertical slice” (ongoing)

Outcomes (example slice):

- Organisations: create/join/roles.
- A simple economy/progression loop.
- One minigame/activity.
- Admin tooling for bans/roles/logs.

