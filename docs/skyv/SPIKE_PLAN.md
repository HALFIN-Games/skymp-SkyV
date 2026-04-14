## SkyMP technical spike plan

### Purpose

Before we build a launcher, a framework, or voice at scale, we must validate what SkyMP already provides and what we need to extend or replace.

### What “done” looks like

At the end of the spike we can:

- Build the client and server from source.
- Run a dedicated server and connect at least one client on a single dev PC.
- Produce an installable client package so a second person/machine can connect later.
- Connect a second client once a second machine is available.
- Run a minimal custom gamemode/resource and observe it live (log output + at least one player-visible effect).
- Identify the specific extension points we will use for:
  - authentication / identity
  - interior/exterior “space id” mapping (for instancing + voice scoping)
  - interest management (entity relevancy + budgets)
  - persistence (player state storage)

### Testing constraints (current)

- We currently have only one dev PC running a known-good SkyMP environment.
- Early validation must therefore be “single-client” plus automation (unit/bot tests) until we can hand an installable client to a second tester.
- The spike must explicitly produce a repeatable “client handoff” artifact (folder/zip) and instructions so multi-client validation can happen as soon as a second machine is available.

### Steps (suggested order)

1. **Clone and build**
   - Use SkyMP upstream as baseline.
   - Confirm toolchain requirements (CMake, vcpkg, Node, VS Build Tools).

2. **Run a local server**
   - Start with default settings.
   - Record ports, config files, and any required client-side setup.

3. **Connect one client (single-machine validation)**
   - Validate stability (crashes, desync symptoms).
   - Note what is already synced well enough for RP.

4. **Create a “tester client” package (for later 2nd machine)**
   - Produce a minimal folder/zip that contains:
     - client files to copy into a clean Skyrim install
     - the exact server IP/port settings required to connect
     - a short “how to run” checklist
   - Confirm a fresh local profile can connect using only these instructions.

5. **Connect two clients (multi-machine validation, when available)**
   - Repeat the join flow with a second machine.
   - Validate replication and basic interaction.

6. **Gamemode/resource hello-world**
   - Add a tiny script that:
     - registers a command (e.g., `/ping`)
     - persists one value per player (e.g., “reputation”)
     - emits a server-to-client event (even if the UI is minimal)

7. **Interiors and “space ids”**
   - Determine how we can reliably identify:
     - worldspace/cell
     - interior instance
   - Write down a mapping strategy that voice can consume.

8. **Interest-management feasibility**
   - Identify where entity updates are broadcast.
   - Prototype or at least document a plan to:
     - compute per-player relevancy sets
     - apply tiered update rates / entity caps

9. **Performance and slot reality**
   - Clarify what “slot count” means in SkyMP deployments:
     - configured max players
     - tested concurrency
     - hotspot density supported
   - Establish initial performance metrics to track (tick time, bandwidth, CPU, memory).

### Reference forks/projects to review

- `skyrim-roleplay/skymp` (fork of SkyMP)
- `skyrim-roleplay/NirnLabUIPlatform` (CEF-based UI platform for Skyrim SKSE plugins)
- `skyrim-roleplay/ied-dev` (Immersive Equipment Displays dev fork)

These are useful for understanding what other teams have changed and what tooling they built around SkyMP, but we should still validate claims (e.g., “650 slots”) against measurable results and hotspot behaviour.

