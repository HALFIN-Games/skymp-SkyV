# SkyV public vs private boundary matrix (draft)

This template helps decide which work must stay public (GPL/AGPL obligations) vs which work can live in private repos/services.

This is not legal advice. It’s an engineering decision aid to reduce license risk and avoid accidentally “baking” proprietary logic into GPL/AGPL codebases.

---

## 1) Repo and license context (current tree)

From `skymp-SkyV`:

- `skymp5-server` → **AGPLv3** (see `skymp5-server/LICENSE`)
- `skymp5-client` → **GPLv3** (see `skymp5-client/LICENSE`)
- `skyrim-platform` → **GPLv3** (see `skyrim-platform/LICENSE`)
- `TERMS.md` summarizes: modifications + distribution require source availability; AGPL has network-use implications.

---

## 2) Boundary principles (recommended)

**Keep public (inside skymp-SkyV):**

- minimal glue/adapters
- protocol translation
- configuration and feature flags
- logging/metrics that don’t expose secrets

**Keep private (separate repos/services):**

- unique admission logic (queue points, reserved slot decisions)
- “business rules” derived from Discord/whitelist/points
- VOIP/session orchestration rules
- proprietary anti-cheat / anti-abuse heuristics
- any monetization/operations logic

**Safer separation style:**

- put proprietary logic behind an API boundary (separate process/service)
- avoid copying proprietary code into GPL/AGPL repos

---

## 3) Decision matrix (fill per feature)

Use this table to decide placement and obligations.

| Feature / Component | Where it runs | Repo (public/private) | Touches AGPL code? | Touches GPL client? | Needs distribution? | Users access over network? | Source obligation likely? | Notes / Risk |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Join ticket verify (signature/exp/jti) | game server | public (adapter) | yes (`skymp5-server`) | no | yes | yes | high (AGPL) | Keep verify minimal; business rules elsewhere |
| Role→points mapping | website | private (website) | no | no | n/a | yes | n/a | Source of truth should be website |
| Queue engine (priority 0–999) | game server sidecar | private service | no (if external) | no | service deployed | yes | depends | Keep it as separate process/service |
| Reserved slots policy | queue sidecar | private service | no (if external) | no | service deployed | yes | depends | “If full, fall back to queue” lives here |
| Client join UI | client | public (GPL) | no | yes | yes | n/a | high (GPL) | UI can stay open; doesn’t reveal business logic |
| VOIP orchestration | separate service | private | no | no | service deployed | yes | depends | Keep away from AGPL tree |

---

## 4) Per-subproject checklist (quick)

For any change you plan to ship:

1) Which subproject is modified?
   - `skymp5-server` (AGPL) / `skymp5-client` (GPL) / other
2) Is it required to ship/operate the server or client?
3) Does it embed proprietary decision logic, or just call an external API?
4) Could it be moved behind a service boundary?
5) What minimal data needs to cross the boundary (schemas only)?

---

## 5) Suggested repo layout (practical)

- `skymp-SkyV` (public): upstream fork + minimal integration glue
- `skyv-identity` (private): join ticket issuance policy (optional if website is authority)
- `skyv-queue` (private): queue engine + reserved slot rules
- `skyv-voip` (private): VOIP/session orchestration
- `skyv-contracts` (private or public): schema definitions for tickets/events/API

---

## 6) What to decide before implementing queue

- Whether queue runs:
  - **in-process** inside `skymp5-server` (simpler, but most likely forces it public under AGPL), or
  - **as a sidecar service** called by the server (more complex, but keeps business logic private).
- What the “adapter” inside `skymp5-server` is allowed to do:
  - recommend: “verify ticket + call queue service + enforce admission outcome”
  - do NOT: “compute role-based points” (website should do that)

