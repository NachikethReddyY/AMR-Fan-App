# Architecture and implementation status

The Make a Mark hackathon concept connects Aston Martin Formula One fans with
sustainable travel and engagement. The [specification](../fan-app-specification.md)
owns product behavior.

| Area | Current implementation | Planned responsibility |
| --- | --- | --- |
| Native phone apps | `Swift-App/` remains the iOS source implementation; `Kotlin-App/` is the standalone Android Jetpack Compose port with matching domain, auth, network, media and fan-flow entry points | Platform-native release and device acceptance |
| React fan app | `apps/fan/` owns the Expo entrypoint, screens, assets, tests and native/web configuration | Cross-platform React client and shared product experiments |
| Admin web | `apps/admin/` owns the workspace entrypoint for the static admin artifact; page sources live under `services/api/` beside their API handlers | Authorized content, price, rule, moderation and demo administration |
| Backend | `services/api/` owns the HTTP API, PostgreSQL modules, migrations, AI adapters, reports, rewards and admin handlers. The activity submission slice adds canonical multi-photo evidence, durable assessment recovery, deterministic rewards, missions and the combined impact overview. | Feature operations and persistence on the selected hosted platform |
| Transport MVP | `services/api/transport/` owns a separately runnable Singapore demo timetable/planner, an authenticated app endpoint and an optional OSRM adapter. | GTFS/GTFS-Realtime ingestion, live traffic, GPS navigation and hosted deployment |
| Shared packages | `packages/contracts/` owns wire types; `packages/travel-domain/` owns pure route, emissions and recommendation logic | Stable cross-client contracts and domain calculations |
| Authentication | Configurable OIDC/PKCE adapter, persisted revocable sessions and server-assigned roles; live provider not provisioned | Verified live email sign-in on the selected provider |
| Operations | Root scripts, Compose, Render and security configuration orchestrate the workspace; `pnpm-workspace.yaml` and Turbo own package discovery and task ordering | Release environment remains a maintainer decision |

The account API has an isolated application DAST target and authenticated HTTP
boundary tests. The points admin flow has local browser and PostgreSQL-backed
HTTP proof. The held phone History consumer has state and actual HTTP/PostgreSQL
proof; its new UI has no native observation yet. Required small-iPhone largest
Dynamic Type and actual VoiceOver proof remain pending. No upload URL exists.
Azure staging has a deployed service from the older `36996ec` revision; the
current PR head is not deployed there. Passive DAST
covers public HTTP only; authenticated tests prove points authorization,
atomicity, replay, concurrency and isolation. See [points operations](../operations/points.md).

## Design defaults

Keep `Swift-App/` and `Kotlin-App/` as independent native projects outside the JavaScript package graph. The JavaScript workspace has explicit fan, admin, API, contracts and travel-domain units. Database-only TypeScript modules live in
`services/api/database/`; its private module marker supports Node ESM without moving
the phone app. See [local development](../operations/local-development.md) for
service ownership, per-worktree databases, commands and cloud setup gates. The authorized workspace migration adds pnpm/Turbo package entrypoints for the API and static admin build without moving runtime source. Do not add a service layer or event system without a concrete need.
Supabase PostgreSQL is the selected application database. BB-1 is the selected
API host for the current MVP deployment package under [`deploy/bb1`](../../deploy/bb1/README.md).
CIAM / Entra External ID remains the authentication provider; Supabase Auth is
not used. The API validates CIAM tokens and maps their issuer/subject to
`app.principals`. Supabase Storage is optional and server-only for explicitly
approved retained report originals; raw activity photos remain transient.

The earlier Azure package under [`deploy/azure`](../../deploy/azure/README.md)
was preparation for a superseded database/hosting choice. It is retained as
historical deployment material and is not the active runtime target. The
configurable account adapter and local setup are documented in [account
operations](../operations/accounts.md). Earlier Convex plans are superseded.

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
inputs, CIAM deployment, Supabase operations and final screen selection remain
open.

Update this map when adding an entry point or integration. Record hard-to-reverse
accepted tradeoffs in `docs/adr/` and link them here.

Written by gpt-6-astra through Codex (T3 Code).

## Sustainability activity assessment API

The backend exposes the Swift integration contract locally through the API
service. `GET /v1/profiles/:profileId/activity-submissions/availability`
reports whether the assessment provider is enabled. `POST
/v1/profiles/:profileId/activity-submissions` accepts a request UUID, a
description and one to five base64 JPEG/PNG photos. `GET
/v1/profiles/:profileId/activity-submissions/:requestId` recovers a prior
assessment by its idempotency key. The server canonicalizes decoded pixels,
rejects duplicates, bounds media and description size, and never persists raw
photo bytes.

The provider adapter is disabled unless `ACTIVITY_ASSESSMENT_ENABLED=true` and
an explicitly supplied server-side provider exists. A disabled deployment
returns `{ "kind": "unavailable", "reason": "disabled" }`; it does not read
or process the submitted media. When a reviewed provider is enabled, accepted
assessments settle exactly 50 points through the existing points ledger, apply
duplicate protections, and optionally advance an enrolled mission. There is no
daily activity cap.

`GET /v1/missions?profileId=...` and `POST
/v1/missions/:missionId/enroll` expose mission state. `GET
/v1/impact/overview?profileId=...` returns separate fan, community and official
impact sections. Migrations `0014` through `0019` own the assessment,
reward-claim, duplicate-image, mission and optional journey-link tables; impact
overview reads the existing journey and activity provenance instead of adding a
separate impact provenance schema.

The contract is implemented and locally unit-tested. The Azure migration job ran
before the deployed `36996ec` image started. Migrations `0018` and `0019`, added
by this PR for the no-cap policy and optional journey-linked preliminary claims,
are newer and remain unapplied in staging.
The provider remains disabled by default; live Swift, Entra and provider
behavior are unverified.

Implemented by gpt-6-luna through Codex (local Windows).

## Photo route compatibility

The current Swift client in `Swift-App/` still calls the earlier local-only
routes `GET /v1/profiles/:profileId/activity/availability` and `POST
/v1/profiles/:profileId/activity/photos`. Those routes remain registered for the
existing loopback fixture flow and are intentionally unavailable in a hosted
deployment; they accept one photo and do not represent the multi-photo contract.

New Swift work should use the versioned assessment routes documented above:
`GET /v1/profiles/:profileId/activity-submissions/availability`, `POST
/v1/profiles/:profileId/activity-submissions`, and `GET
/v1/profiles/:profileId/activity-submissions/:requestId`. The POST body is
`{requestId, description, photos:[{mime,base64}], missionId, journeyId?}`.
`journeyId` optionally links accepted active-transport evidence to an owned
journey for preliminary settlement. A disabled server
returns `503` with `{kind:"unavailable",reason:"disabled"}` before reading
media. A provider-enabled server returns the validated assessment result and,
when accepted, the reward and mission decisions.

This keeps the Swift migration additive: clients can detect the new availability
route first, then fall back to the old loopback route only for local fixture
development. Do not send the old `profileId`, `capture` or `activity` fields to
the new endpoint; profile ownership comes from the authenticated path/session,
and the server decides the category and points.

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

The repo is recognized by pnpm as the root workspace plus `@amr/fan`,
`@amr/admin`, `@amr/api`, `@amr/contracts`, and `@amr/travel-domain`. Turbo runs
package-local checks. The admin package builds the static pages from its own
`pages/` directory, while the API serves the same allowlisted files locally.
