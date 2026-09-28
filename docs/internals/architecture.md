# Architecture and implementation status

The Make a Mark hackathon concept connects Aston Martin Formula One fans with
sustainable travel and engagement. The [specification](../fan-app-specification.md)
owns product behavior.

| Area | Current implementation | Planned responsibility |
| --- | --- | --- |
| Phone app | `src/App.tsx` retains four tabs; held account UI and server balance/History consumer in `src/features/account/` and `src/features/points/`; Travel/Impact placeholders and unavailable Redemption | Native verification, journeys, fan submissions and other accepted rewards, plus ESG views |
| Admin web | Separate `/admin/` points adjustment and History page with synthetic local sign-in; live browser sign-in remains pending | Authorized content, price, rule, moderation and demo administration |
| Backend | `server/api/` account HTTP API, `server/accounts/` PostgreSQL ownership and independent real/demo profiles, and `server/points/` integer adjustments with immutable History and stored outcomes; no deployment | Feature operations and persistence on Azure |
| Authentication | Configurable OIDC/PKCE adapter, persisted revocable sessions and server-assigned roles; live provider not provisioned | Verified live email sign-in on the selected provider |
| Maps and tracking | Absent | POC route comparison, real location collection and journey assessment; physical-device proof required |
| AI media pipeline | Absent; future proposal | Bounded transient processing and validated results |
| ESG integration | Source documents and proposals only | POC report upload, extraction, admin review and approved metrics with source evidence |
| Operations | Local Expo commands, repository checks and isolated worktree PostgreSQL tooling | Release environment remains a maintainer decision |

The account API has an isolated application DAST target and authenticated HTTP
boundary tests. The points admin flow has local browser and PostgreSQL-backed
HTTP proof. The held phone History consumer has state and actual HTTP/PostgreSQL
proof; its new UI has no native observation yet. Required small-iPhone largest
Dynamic Type and actual VoiceOver proof remain pending. No upload URL or deployed service exists. Passive DAST
covers public HTTP only; authenticated tests prove points authorization,
atomicity, replay, concurrency and isolation. See [points operations](../operations/points.md).

## Design defaults

Keep the existing root Expo package while the explicit workspace units coexist. The Swift app remains an Xcode project outside the JavaScript package graph. Database-only TypeScript modules live in
`server/database/`; its private module marker supports Node ESM without moving
the phone app. See [local development](../operations/local-development.md) for
service ownership, per-worktree databases, commands and cloud setup gates. The authorized workspace migration adds pnpm/Turbo package entrypoints for the API and static admin build without moving runtime source. Do not add a service layer or event system without a concrete need.
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

## Disabled photo client

Home offers Photo activity to a signed-in real profile. The system camera opens
before description entry. Capture bytes and draft text stay on the phone and are
cleared after checks, retake, close, Home navigation blur, or identity invalidation.
Same-account foreground refresh keeps the flow mounted and blocks checks while
loading. Explicit logout, replacement sign-in, profile switching and confirmed
expiry notify draft owners before the controller publishes loading.

The client can only GET authenticated activity availability. It cannot upload
photos, call an AI provider or award points. The photo backend, API registration
and accounting migration are not included in PR28's client integration. A missing
endpoint remains an honest failure; local availability fixtures do not establish
hosted readiness. Expo camera access excludes microphone and photo-library access.

Implemented by gpt-6-astra through Codex (T3 Code).


## Swift and local photo integration, 28 September 2026

`Swift-App/` now has a Keychain-backed backend session, a local synthetic sign-in
button, transient JPEG upload client, and a route-query consumer. The Swift map
still uses MapKit for route geometry and navigation. Backend route options and
legs appear in the expanded planner when a signed-in local backend is available.

The photo POST is enabled only with explicit loopback development flags. The
server awards exactly 50 points only for one pinned synthetic fixture image
and activity. Arbitrary photos return zero. Production remains disabled and no
vision provider is called. The gpt-6-astra classifier prompt is prepared under
`docs/backend-prompts/photo-activity-astro.md`, not activated.

The repo is now recognized by pnpm as root Expo, `@amr/admin`,
`@amr/api`, and `@amr/contracts`; Turbo runs focused package tasks. Runtime
source and deployment files remain at their existing paths. The admin package
builds the existing static pages; it is not a new admin product.
