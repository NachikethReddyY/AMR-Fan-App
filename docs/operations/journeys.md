# Server journey recording

Issue #8's server module is under `server/journeys/`. It persists preparation,
Start, original-timestamp evidence, finish and a deterministic assessment in the
same PostgreSQL service as accounts. API registration is pending a serialized
handoff. No public journey endpoint, native collector, award or deployment is
claimed by this document.

## Authority and retained data

`createJourneyService({pool, env, policy, clock})` supplies `prepare`, `start`,
`appendEvidence`, `finish`, `read` and server-only `cleanup`. The optional clock
exists for controlled tests and is refused in production. Each fan operation
accepts a session token, validates it against the account session store, holds
that session against concurrent revocation, locks the owned profile and journey,
and checks session expiry again before commit. A selected ID grants no access.
An admin role does not grant another user's path access.

`prepare(token, {profileId, requestId}, serverRoute)` is an internal boundary.
The third argument must come from the route backend's validated server result,
never a request body. Its immutable snapshot contains route provenance, fetched
time, query binding, endpoints, decoded geometry, ordered mode/distance/duration
legs, factor contents/versions, earning-rule values and same-query car-baseline
distance/duration, or an explicit unavailable calculation basis. Missing geometry or unsupported route data
fails validation. The HTTP adapter must select by a returned route ID from that
same response, preserve fixture/factor applicability and reject client-supplied
geometry, factor, verdict, owner, role or award fields. That adapter remains
pending until the provider prerequisite and root/API handoff are integrated.

Start requires a persisted preparation, a stable request UUID and a capture
session UUID. It records the server start time and retains the configured
assessment policy. No evidence from before that acknowledgment is accepted.
Evidence and finish require the same owner and capture session. The fixture
route switch `JOURNEY_FIXTURES_ENABLED=true` is allowed only in explicit test or
development environments and is rejected in production. Fixture route provenance
remains visible on every summary. Synthetic traces do not prove real travel.

## Evidence and retry contract

A batch has a request UUID and 1–100 samples. Each sample has a stable UUID,
original acquisition time, device receipt time, latitude/longitude, nullable
accuracy, foreground/background/unknown context and nullable mocked-location
flag. Times use integer Unix milliseconds. Unknown values stay unknown. The
server records its own receipt time separately and permits at most 4,096 retained
samples per journey. The future HTTP
adapter must also bound bytes before parsing.

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
The native durable queue and collection shutdown are separate pending work.

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

## Local proof and pending integration

Use only the namespace provisioned for the current worktree:

```sh
pnpm db:run-test -- node --test server/journeys/store.test.ts
node --test server/journeys/evidence.test.ts
```

Tests use real sessions and PostgreSQL rows, concurrent operations, reconnects,
negative authorization, request conflicts, batch rollback, original-time offline
submission, finish races, candidate thresholds and precise-data expiry. Raw-row
checks are limited to the explicitly required persistence/immutability/deletion
claims. Fixtures use synthetic coordinates and do not call providers or models.
No shared database lifecycle action is needed.

Migration `0004_journeys.sql` owns journey storage. Migration 0003, the points
ledger, shared API dispatch/root files and native navigation belong to their
assigned owners. After those prerequisites integrate, add the granted HTTP
adapter and run actual authenticated HTTP, repository/security and isolated
application DAST before presenting a final candidate. Preserve account/points
regressions. Physical iOS and Android foreground/background/locked-phone,
permission and Stop collection proof remains required for whole issue #8.

Written by gpt-6-astra through Codex (T3 Code).
