# Server journey recording

Issue #8's server module is under `services/api/journeys/`. It persists preparation,
Start, original-timestamp evidence, finish and a deterministic assessment in the
same PostgreSQL service as accounts through the authenticated API. Native
collection is implemented under `legacy/react-native/src/features/journeys/` (archived); device verification,
physical calibration and deployment are separate acceptance gates.

## Authority and retained data

`createJourneyService({pool, env, policy, clock, queryRoutes})` supplies `preparePlan`, internal `prepare`, `start`,
`appendEvidence`, `finish`, `read`, `listOwned` and server-only `cleanup`. The optional clock
exists for controlled tests and is refused in production. Each fan operation
accepts a session token, validates it against the account session store, holds
that session against concurrent revocation, locks the owned profile and journey,
and checks fresh database time after acquiring the session lock, after later
lock waits and before commit. A locking SELECT can evaluate its expiry predicate
before waiting on an unchanged row, so its predicate alone is insufficient. A selected ID grants no access.
An admin role does not grant another user's path access.

`POST /v1/journeys/prepare` accepts only `{profileId, requestId, query}`.
The query is the merged route input: origin, destination, primary modes and
extra minutes. It uses the same `createRouteQuery` instance as `/v1/routes/query`,
including its actor limits, provider call/byte/deadline budgets and no retries.
Current authority and owned real profile are checked before provider spend.
The response is either `{kind: 'unavailable', reason}` or `{kind: 'prepared',
candidates}`. A supported candidate contains its route ID and prepared journey;
an unsupported candidate contains its route ID and explicit reason. Missing
geometry does not become an empty trace or a startable journey.

The preparation transaction persists every supported candidate from that exact
server response before returning IDs. Start selects an owner-bound journey ID;
it does not echo geometry or refetch a changed route. Concurrent/restarted retries
return the immutable preparation receipt without provider calls. A failed provider
result also remains the original receipt; a fresh query requires a new request ID.
The receipt contains no query text or coordinates. The internal `prepare(token,
{profileId, requestId}, serverRoute)` remains available for controlled domain tests,
and is not an HTTP input path.

### Phone comparison from one preparation

Related to #8; route/comparison dependencies #6 and #7, parent tracker #3.
This is partial server work, with native, physical and live-provider acceptance
still pending. No issue closure is implied.

New preparation receipts include optional `display` version 1. It retains the
same server result's routes, provider total durations (including transit waits),
nonprecise legs, estimates, recommendation, mode outcomes, factors and provenance.
The phone displays `display.routes` and joins a selected row by `routeId` to this
same receipt's `candidates`, then starts that candidate's persisted `journey.id`.
Comparison-only routes remain visible when geometry or tracking bounds prevent
preparation. Display availability is not Start eligibility or an award.

Do not query routes separately and match a later preparation by position or ID.
Replays and Start do not query the provider again. A changed search uses a new
request ID and requires confirmation of the newly displayed candidate. The
projection has at most 12 routes, 128 legs per route and four mode outcomes;
it stores no origin/destination, coordinates, geometry or leg descriptions.
Old receipts replay unchanged with `display` absent, explicitly meaning full
comparison unavailable. They are not enriched, migrated or given replacement IDs.

Future earning-basis publication must use the same caller transaction to lock
and compare the accepted basis at Start. A new Start with a stale required basis
must return a distinguishable 409 for refresh and confirmation; an already
successful replay keeps its original receipt. That separate integration is not
implemented by this display change.

The immutable expiring snapshot retains validated query binding, decoded geometry,
provider endpoints and ordered legs. Nonprecise summaries retain source,
primary request mode, factor applicability and geography dataset version, factor
contents/versions and the fastest same-query conventional-car baseline with its
ordered legs. Applicability comes only from provider evidence; regionCode and
client geography claims grant no factor authority. Missing baseline/applicability
stays explicitly unavailable. No client factor, verdict, owner, role or award is
accepted. Fixture endpoints are loopback-only, test-only provider configuration;
no live Google call is part of local proof.

| Operation | Method/path | Strict body |
| --- | --- | --- |
| Prepare route candidates | `POST /v1/journeys/prepare` | `profileId`, `requestId`, `query` |
| Start selected candidate | `POST /v1/journeys/:id/start` | `requestId`, `captureSessionId` |
| Append evidence | `POST /v1/journeys/:id/evidence` | `requestId`, `captureSessionId`, `samples` |
| Finish | `POST /v1/journeys/:id/finish` | `requestId`, `captureSessionId`, `endedAtMs`, `reason` |
| Discover active/recent journeys | `GET /v1/profiles/:profileId/journeys` | no body; optional `state=active`, `limit`, `before` query |
| Current state / assessment | `GET /v1/journeys/:id` or `.../:id/assessment` | none |

All routes use existing session, origin, content type and rate controls. General
bodies stay at 4 KiB; only evidence bodies allow 32 KiB, still bounded before JSON
parsing. Responses are no-store. Cleanup is server-only and has no fan endpoint.

Start requires a persisted preparation, a stable request UUID and a capture
session UUID. It records the server start time and retains the configured
assessment policy. No evidence from before that acknowledgment is accepted.
Evidence and finish require the same owner and capture session. The fixture
route switch `JOURNEY_FIXTURES_ENABLED=true` is allowed only in explicit test or
development environments and is rejected in production. Fixture route provenance
remains visible on every summary. Synthetic traces do not prove real travel.

## Phone restart discovery

`listOwned(token, profileId, query = {})` reads current owner-scoped summaries.
The strict query accepts only `state: 'active'` or omitted (recent), `limit`
(default 20, integer or decimal string 1–50) and optional `before` (opaque cursor,
maximum 512 characters). It returns `{profileId, asOfMs, items, nextCursor}`.
Items contain only `id`, `state`, `mode`, `source`, preparation/Start/finish/precise
expiry timestamps, and assessment status/version/revision/calibration. Exported
`JourneyList` and `journeyListSchema` define the caller response.

Recent means all existing states ordered by immutable preparation time and ID,
both descending. The cursor binds that tuple to profile and active/recent view;
it conveys no authority. Multiple active journeys remain separate. Refresh starts
at the first page; newly prepared rows do not move into an older page, while a
concurrent finish can remove a row from the active view. Fetch detail by discovered
ID to reconcile current state and capture session. There is no single-active rule,
implicit Start, cancellation, reconstructed GPS or automatic native collection.

The new discovery read uses the existing journey `authorized` helper unchanged.
After that helper acquires and validates the session row, `listOwned` locks the
owned profile and calls its supplied `current()` guard before reading summaries;
the helper retains its existing final check. This defines the new read boundary
only. Existing journey methods and points authorization semantics are unchanged.
Anonymous/expired/revoked sessions receive 401; foreign or missing profiles receive 404, including for admins;
invalid input or a mismatched cursor receives 400. An empty owned view succeeds.
The query selects no snapshots or raw samples and performs no application writes,
cleanup or retention extension. Expired active rows retain their state and original
expiry; discovery does not make them recordable again.

The authenticated `GET /v1/profiles/:profileId/journeys` is registered under the
existing origin, rate, error and no-store controls. It rejects duplicate search
keys, then passes bearer token, path ID and the search-parameter object to
`journeys.listOwned`. The service rejects unknown keys. Existing known-ID GET and
prepare dispatch are unchanged. Registered HTTP tests cover recovery after an API
process restart, multiple active records, pagination, ownership, current authority
and no read-side cleanup. Passive DAST covers reachable public/diagnostic routes;
it does not authenticate as a fan or replace these authorization tests. Native
discovery is integrated; physical platform calibration remains pending.

## Evidence and retry contract

A batch has a request UUID and 1–100 samples. Each sample has a stable UUID,
original acquisition time, device receipt time, latitude/longitude, nullable
accuracy, foreground/background/unknown context and nullable mocked-location
flag. Times use integer Unix milliseconds. Unknown values stay unknown. The
server records its own receipt time separately and permits at most 4,096 retained
samples per journey. The HTTP adapter also bounds bytes before parsing.

Out-of-order delivery is assessed in acquisition-time order. Identical sample
IDs are deduplicated; changed evidence for an existing sample ID conflicts.
Samples cannot be acquired in the future, outside the acknowledged capture
interval, or after an accepted finish. Receipt time cannot precede acquisition
or exceed server receipt time. A partial conflicting batch rolls back entirely.
Sample updates are rejected at the database boundary; retention can delete raw
samples. An acquisition gap remains explicit, never interpolated into travel.

Finish accepts original `endedAtMs` and one of `arrival`, `stopped`,
`permission_revoked`, `interrupted` or `abandoned`. It must not precede already
stored samples. The server serializes finish and ingest on the same journey.
Valid delayed pre-finish evidence can revise the assessment after finish;
post-finish collection cannot. Interruption terminally closes that capture
interval in this slice; another journey needs a new acknowledged Start. Offline
continuation needs no new Start while the existing capture interval stays open.
The native durable queue and collection shutdown are implemented below.

Requests are unique per authenticated principal. The server records a bounded
non-coordinate result and a canonical payload fingerprint in the mutation
transaction. Matching replay returns its original receipt even after later
assessment or expiry; the current `read` result may be newer. Reusing a request
ID with a different action, target or payload conflicts. Fresh request IDs do
not duplicate samples or restart/finish an already transitioned journey.

## Versioned prototype assessment

The result has `satisfies_configured_rules`, `insufficient_evidence`, `ineligible`
or `unfinished`, separate from `calibration: unvalidated` and fixture/live route
provenance. There is no physically verified flag. These deterministic results
are useful to later local #9 settlement tests; #9 owns award authority, accepted
rule versions and real/fixture separation. This module never changes points.

Manager-approved calibration candidates are accuracy at most 50 m, an endpoint
uncertainty circle contained within 100 m, endpoint acquisition within 30 s of
start/finish, a 100 m route corridor and a 120 s continuity gap. Configuration
is versioned and bounded to these upper limits. Smaller configured values are
supported. The persisted version combines the evaluator's version with a hash
of the complete validated configuration, so reusing a label cannot hide changed
thresholds. Evidence policy is selected at Start and remains fixed afterwards.
These numbers are not measured physical acceptance thresholds.

Assessment reports endpoint presence, sample count, acquisition-time duration,
uncertainty-adjusted observed distance and maximum observed segment speed. It
checks route corridor and ordered progress. Reverse progression beyond position
uncertainty, conflicting same-time positions, known mock locations or definite
off-route evidence produce ineligible results. Uncertain accuracy/corridor,
gaps, missing endpoints, stopped travel and insufficient movement remain
insufficient evidence. Unknown mocked status is not proof of authenticity.

No numerical transport-mode speed bounds are approved. The retained policy can
supply bounded `maxSpeedMpsByMode` calibration candidates; tests demonstrate
consistent/inconsistent outcomes using an explicit synthetic value. Without
one, `modePlausibility` is `unassessed` and the measured speed is still returned.
Do not substitute route ETA or the fan's extra-time tolerance as an award speed
or duration cutoff. GPS speed cannot prove bus/train use. Rule satisfaction is
limited to the configured checks, not blanket real-world eligibility.

Repeated coordinates and shared segments can represent more than one ordered
route position. The assessor retains positions within the sample's existing
accuracy uncertainty of the nearest spatial match, then selects the closest
progression from the preceding sample. It uses one consistent segment length
along the route, including at a loop's repeated origin. Duplicate vertices remain
valid; they do not create extra progression.

Distinct route positions equally plausible within consecutive samples' accuracy
uncertainty produce `ambiguous_progression` and insufficient evidence. The
assessor resumes direction checks only after position is unambiguous again;
it does not assume the greatest forward progress. For example, an overlapping
out-and-back trace may not distinguish intended forward traversal from reversal.
An unambiguous backwards step or definite off-route sample remains ineligible.
This resolves an existing ordered-adherence ambiguity without changing numeric
calibration thresholds or claiming physically verified travel.

## Future settlement interface

`services/api/journeys/settlement.ts` exports the compile-ready
`lockJourneyForSettlement(client: PoolClient, principalId, profileId, journeyId)`
and `JourneySettlementProjection`. The caller must already be inside its current
authority/request transaction. The function reacquires the owned profile lock,
then locks the matching journey, using the same client. Order is authority,
request, owned profile, journey. It starts no nested transaction and performs no
network call, award or balance change. Future settlement must perform its own
fresh-session check before effects/replay according to the points boundary.

The projection includes `basis`, `routeEvidence`, `selectedLegs`, `assessedLegs`,
`earningPolicy`, `policy`, source, state/start/finish and assessment. It never reads
or returns coordinates, route geometry or query text. `assessmentIdentity` is
`{journeyId, version, revision}`; finish and new evidence advance assessment
revision, while duplicate samples and successful retries do not. Evidence revision
is distinct. Validated start/arrival facts and reasons stay in `assessment`.

Start fixes earning policy `initial-50-cap-2000-v1`: 50 points/kg, cap 2,000 and
arithmetic version `floor-decimal-v1`. This records policy only. Future #9 computes
unrounded decimal savings times the retained rate, floors once and applies the
cap. An unstarted journey has `earningPolicy: null`; no old missing version is
silently filled. Factor/earning approval and fixture/real separation belong to #9.

`selectedLegs` preserves provider distances. A satisfying single-mode trace
uses `gps_single_mode_lower_bound`. Complete ordered provider leg geometry can
use `gps_leg_geometry_lower_bound` for a multimodal trace. The geometry comes
from the same Google step response or continuous OneMap itinerary and has at
most 2,048 total points. Each observed interval must belong uniquely to one leg,
in order, and every leg must pass its own evidence assessment. Missing shapes,
overlap, uncertain transitions and partial matches remain unavailable. Neither
method allocates planned distance ratios or verifies the reported transport mode.
Only the nonprecise assessed legs survive precise-data deletion.

## Native recording

Travel uses the prepared comparison directly. Starting requests location access;
denial leaves planning available. The selected trip and Arrived/Stop replace
search while recording. The session observer lives above the tabs. Arrival and
Stop freeze the timestamp immediately and persist the intent on the local-write
queue even when a network upload is pending. Upload acknowledgments remove only
acknowledged samples. Retried operations keep their original IDs and timestamps.

`runtime.ts` registers the Expo background task at module scope. Headless callbacks
write GPS evidence without reading session credentials or calling authenticated
APIs. `location.ts` retains acquisition time, accuracy, OS mock flag and capture
context. Termination can interrupt OS delivery; the app shows paused recording
and requires an explicit Resume. It does not reconstruct missing travel.

`storage.ts` keeps an AES-GCM encrypted SQLite record and a device-only SecureStore
key accessible after the first unlock. The record contains the selected trip,
bounded sample queue and mutation intents, never authentication tokens. Collection
and network queues are separate so slow uploads do not delay durable samples or
Stop. Transient account loading/unavailability suspends dispatch while an
already-bound capture retains local Stop. Authenticated matching restoration is
required before network retry or Resume. Every network operation rechecks the
capture generation after asynchronous waits. There are at most 4,096 samples,
uploaded in batches of 50. Logout/profile invalidation stops collection, invalidates delayed responses and removes local
ciphertext/key. Expired data is removed on restore, retry or callback; dormant
and backup storage still need the retention limits below.

The phone reads current server assessments and settlements. Provisional receipts
label their planned-estimate basis and separate the new credit from cumulative
journey credit. They are excluded from verified impact. The server controls
policy/factor releases and top-ups; Start still accepts only request and capture
session IDs. No native input grants award authority.

The location/SQLite dependencies and config plugins were compiled in internal
Android and iOS builds. Pixel proof covers permission denial, encrypted capture
recovery, callbacks and Finish. iPhone proof covers SecureStore onboarding,
background callbacks, offline Stop, cold restart/reconnect, profile/logout
isolation and largest-text contribution reachability. Device proof uses simulated
movement; it does not establish physical calibration or locked-phone behavior.
Native provisional receipt and populated Impact rendering remain unverified;
registered HTTP and component tests cover their contracts separately. Internal
proof packages are not final release artifacts.

## Retention and cleanup

Precise route snapshot expiry is seven days after provider acquisition
(`fetchedAt`), not preparation or retry time. Samples expire seven days after
acquisition. This slice deletes all remaining raw samples when the route snapshot
expires, which can be earlier than a sample's own maximum deadline. Exact
coordinates, route geometry and location query text live only in the deletable
snapshot/sample rows, not in immutable receipts or summaries.

`cleanup()` removes up to 100 expired journeys' precise records per transaction
with `SKIP LOCKED`. Repeat bounded invocations until both returned counts are
zero. Authorized reads/mutations also purge the target's expired precise data
before use. Cleanup preserves non-coordinate summaries, retained versions,
successful receipts, profile balances and other unexpired journeys. Replay
cannot restore expired coordinates. No scheduler or persistent process is
started by this module. Deployment must schedule cleanup before using real
traces; an outage prevents a physical wall-clock deletion guarantee.

Native local queue expiry, device backups and server backups require their own
retention coverage before real data. A dormant device cannot run deletion at an
exact deadline. This server test does not prove that physical or backup cleanup.

## Local proof and remaining acceptance

Use only the namespace provisioned for the current worktree:

```sh
pnpm journey:test:database
pnpm journey:test
```

Tests use actual HTTP, real sessions/PostgreSQL, the merged route parser and a
loopback synthetic upstream. Separate API processes stop and restart against the
same database; original receipts and assessments survive. Cases cover ownership,
revocation, concurrent preparation, replay, bounded upload, evidence/finish races,
late evidence, retained settlement inputs and precise cleanup. Domain checks cover
candidate thresholds, malformed/future evidence, unchanged-session-row expiry
waits and 4,096-sample limits. Raw-row inspection is restricted to persistence,
immutability and deletion claims. These are synthetic traces, not physical travel.

Migration `0004_journeys.sql` owns this storage and is merged. Only the allocated
worktree test database is reset for its changes.
No shared service lifecycle action is required. The CI database job runs the same
journey command after account, points and route tests. Source security and isolated
combined API DAST complement authenticated business tests; unauthenticated passive
crawling does not establish owned-path authorization.

Physical iOS/Android calibration and locked-phone proof remain required for
whole issue #8. Simulator integration does not prove real travel, approved factor
deployment, production cleanup scheduling or backup retention.

Written by gpt-6-astra through Codex (T3 Code).
