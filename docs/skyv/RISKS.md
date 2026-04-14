## Risks and mitigations (draft)

### Technical risks

- **Engine limitations in dense areas (client stability / FPS / crashes)**
  - Mitigation: strict interest management tiers; hard caps on high-fidelity entities; instanced interiors; test early with synthetic load.

- **Multiplayer correctness gaps**
  - Mitigation: prioritise “RP correctness” (chat, emotes, economy, permissions) before attempting full combat/mechanics parity; ship features behind server-config toggles.

- **Voice complexity (true positional at scale)**
  - Mitigation: audibility budget per listener; strict space boundaries; start with proximity only, then add channels; build voice as separate subsystem.

- **Cheat surface / trust model**
  - Mitigation: server-authoritative persistence; validate critical actions; rate limits; logging; moderation tooling.

### Product risks

- **Onboarding friction (mods, load order, conflicts)**
  - Mitigation: launcher-managed isolated profiles; hash verification; automatic repair; clear separation of “server-required” vs “user overlay”.

- **Support burden from user visual mods**
  - Mitigation: explicit policy: “visual overlay unsupported”; provide a safe “allowed overlay list” (optional) or a “clean join” switch.

### Legal and community risks

- **Third-party mod redistribution permissions**
  - Mitigation: default to “download from source” workflows; store only manifests and hashes; clear opt-in policies for bundled content.

- **Fork obligations and licensing compliance**
  - Mitigation: legal review of SkyMP terms and included licenses; maintain clear attribution; keep a compliance checklist.

### Operational risks

- **Server directory abuse / fake servers**
  - Mitigation: server registration tokens; rate limits; reputation; manual verification for featured servers.

- **DDoS and harassment**
  - Mitigation: basic rate limiting, WAF for directory/auth; guidance for server owners; consider optional relay services later.

