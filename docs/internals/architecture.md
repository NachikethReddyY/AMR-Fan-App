# Architecture and implementation status

The Make a Mark hackathon concept connects Aston Martin Formula One fans with
sustainable travel and engagement. The [specification](../fan-app-specification.md)
owns product behavior.

| Area | Current implementation | Planned responsibility |
| --- | --- | --- |
| Phone app | `index.ts` registers `src/App.tsx`; one Expo starter screen | Fan journeys, rewards and ESG views |
| Admin web | Absent | Authorized content, price, rule, moderation and demo administration |
| Backend | `convex/README.md` only; no dependency, schema or deployment | Authenticated application operations and persistence |
| Authentication | Absent; provider not selected | Server-verified identity and assigned admin role |
| Maps and tracking | Absent | Route comparison; later real-device journey evidence |
| AI media pipeline | Absent; future proposal | Bounded transient processing and validated results |
| ESG integration | Source documents and proposals only | Team data with source, reporting date and limits |
| Operations | Local Expo commands and repository checks | Release environment remains a maintainer decision |

No admin endpoint, upload URL or deployed application service exists to audit
dynamically. The DAST fixture validates the scanner, not future product behavior.

## Design defaults

Keep one package until a concrete web/backend requirement justifies another
layout. Do not introduce a monorepo, service layer or event system speculatively.
Existing Convex plans do not imply a provisioned service or selected auth provider.

At external boundaries, authenticate, authorize the operation and resource,
validate input, and translate provider failures into domain outcomes.
Keep policy and calculations independent of network, clock and framework APIs.
The UI follows `DESIGN.md`; it cannot establish roles, prices or eligibility.

When persistence is implemented, preserve these accepted invariants:

- Every real and demo profile starts with zero spendable points.
- Only demo profiles earn simulated journey points; real accounts may spend admin grants.
- Balance, History and an accepted operation change atomically, once per operation.
- Shared contributions survive personal demo reset. Reset preserves purchases,
  content access and History, clears available points, cancels unfinished simulation
  and requires fresh purchase confirmation.
- Corrections append a reasoned record instead of rewriting prior point history.
- Admin privilege comes from trusted authorization, not a client badge or field.

The [points/rewards design](../points-rewards-design.md) owns detailed state rules.
Calculation policy, ESG totals, authentication and final screen selection remain
explicit decisions. Security defaults do not resolve them by implication.

Update this map when adding an entry point or integration. Record hard-to-reverse
accepted tradeoffs in `docs/adr/` and link them here.

Written by gpt-6-astra through Codex (T3 Code).
