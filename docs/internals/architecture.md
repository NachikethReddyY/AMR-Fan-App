# Architecture and implementation status

The Make a Mark hackathon concept connects Aston Martin Formula One fans with
sustainable travel and engagement. The [specification](../fan-app-specification.md)
owns product behavior.

| Area | Current implementation | Planned responsibility |
| --- | --- | --- |
| Phone app | `index.ts` registers `src/App.tsx`; committed Expo starter. Separate uncommitted UI work adds Home and four tabs with Travel/Rewards/Impact placeholders | Native iOS/Android journeys, fan submissions and other accepted rewards, plus ESG views |
| Admin web | Absent | Authorized content, price, rule, moderation and demo administration |
| Backend | No backend dependency, schema or deployment; `convex/README.md` is a historical placeholder superseded by the Azure decision | Authenticated application operations and persistence on Azure |
| Authentication | Absent; provider not selected | Server-verified identity and assigned admin role |
| Maps and tracking | Absent | POC route comparison, real location collection and journey assessment; physical-device proof required |
| AI media pipeline | Absent; future proposal | Bounded transient processing and validated results |
| ESG integration | Source documents and proposals only | POC report upload, extraction, admin review and approved metrics with source evidence |
| Operations | Local Expo commands and repository checks | Release environment remains a maintainer decision |

No admin endpoint, upload URL or deployed application service exists to audit
dynamically. The DAST fixture validates the scanner, not future product behavior.

## Design defaults

Keep one package until a concrete web/backend requirement justifies another
layout. Do not introduce a monorepo, service layer or event system speculatively.
Azure is the selected backend platform. No Azure service, deployment or auth provider
has been selected or provisioned. Earlier Convex plans are superseded.

At external boundaries, authenticate, authorize the operation and resource,
validate input, and translate provider failures into domain outcomes.
Keep policy and calculations independent of network, clock and framework APIs.
The UI follows `DESIGN.md`; it cannot establish roles, prices or eligibility.

When persistence is implemented, preserve these accepted invariants:

- Every real and demo profile starts with zero spendable points.
- Real accounts earn eligible location-assessed journey awards and may spend admin grants. Only demo profiles earn simulated journey points.
- Balance, History and an accepted operation change atomically, once per operation.
- GPS fallback awards require recorded start and arrival and cannot exceed 50 points or the expected award. They retain the evidence status. Later evidence can append only the difference to a higher total award; endpoint-quality thresholds still need device validation.
- Shared contributions survive personal demo reset. Reset preserves purchases,
  content access and History, clears available points, cancels unfinished simulation
  and requires fresh purchase confirmation.
- Corrections append a reasoned record instead of rewriting prior point history.
- Admin privilege comes from trusted authorization, not a client badge or field.

The [feature specifications](../features/README.md) own product rules and acceptance cases.
The [points/rewards design](../points-rewards-design.md) owns the shared module responsibility.
Baseline, time tolerance, top-ups and lifetime totals are confirmed. Numerical
inputs, authentication, Azure services and final screen selection remain open.

Update this map when adding an entry point or integration. Record hard-to-reverse
accepted tradeoffs in `docs/adr/` and link them here.

Written by gpt-6-astra through Codex (T3 Code).
