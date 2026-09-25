# Architecture and implementation status

The Make a Mark hackathon concept connects Aston Martin Formula One fans with
sustainable travel and engagement. The [specification](../fan-app-specification.md)
owns product behavior.

| Area | Current implementation | Planned responsibility |
| --- | --- | --- |
| Phone app | `index.ts` registers `src/App.tsx`; Home and four tabs with Travel/Rewards/Impact placeholders | Native iOS/Android journeys, fan submissions and other accepted rewards, plus ESG views |
| Admin web | Separate `/admin/` points adjustment and History page with synthetic local sign-in; live browser sign-in remains pending | Authorized content, price, rule, moderation and demo administration |
| Backend | `server/api/` account HTTP API, `server/accounts/` PostgreSQL ownership and independent real/demo profiles, and `server/points/` integer adjustments with immutable History and stored outcomes; no deployment | Feature operations and persistence on Azure |
| Authentication | Configurable OIDC/PKCE adapter, persisted revocable sessions and server-assigned roles; live provider not provisioned | Verified live email sign-in on the selected provider |
| Maps and tracking | Absent | POC route comparison, real location collection and journey assessment; physical-device proof required |
| AI media pipeline | Absent; future proposal | Bounded transient processing and validated results |
| ESG integration | Source documents and proposals only | POC report upload, extraction, admin review and approved metrics with source evidence |
| Operations | Local Expo commands, repository checks and isolated worktree PostgreSQL tooling | Release environment remains a maintainer decision |

The account API has an isolated application DAST target and authenticated HTTP
boundary tests. The points admin flow has local browser and PostgreSQL-backed
HTTP proof; phone History acceptance remains pending the held account UI and
native verification. No upload URL or deployed service exists. Passive DAST
covers public HTTP only; authenticated tests prove points authorization,
atomicity, replay, concurrency and isolation. See [points operations](../operations/points.md).

## Design defaults

Keep the existing root Expo package. Database-only TypeScript modules live in
`server/database/`; its private module marker supports Node ESM without moving
the phone app. See [local development](../operations/local-development.md) for
service ownership, per-worktree databases, commands and cloud setup gates. Do not introduce a monorepo, service layer or event system speculatively.
Azure is the selected backend platform. No Azure service, deployment or auth provider
has been selected or provisioned. The configurable account adapter and local
setup are documented in [account operations](../operations/accounts.md). Earlier Convex plans are superseded.

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
