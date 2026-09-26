# Journey awards

The owned server modules implement #9/#10 calculation and transactional accounting.
The authenticated API registers settlement and owner-read routes. Calculation and accounting are
locally verified with synthetic server fixtures; production credit is pending
trusted factor and calibration validation. A working configured-rule assessment
remains visible and is not a claim of physically verified travel.

## Policy and retained basis

[Feature 05](../features/05-points-and-history.md) owns earning and fallback rules;
[feature 03](../features/03-emissions-estimates.md) owns the comparison baseline,
compatible factors and missing-data policy. `initial-50-cap-2000-v1` retains
50 points/kg and a 2,000-point journey cap at Start. `floor-decimal-v1` computes:

1. Baseline emissions from the retained same-query conventional-car route legs.
2. Journey emissions as the sum of supported assessed leg distances times their
   retained passenger-kilometre factors, with metres divided by 1,000.
3. `savings = max(0, baselineKg - journeyKg)`.
4. `target = min(2000, floor(savings * 50))`.

The implementation treats each finite retained number's canonical JavaScript
base-10 string as the exact input and calculates using integer coefficients and
decimal scales. It does not recover precision already lost before persistence.
No binary multiplication, per-leg rounding or display rounding sets the award.
0.0199 kg gives 0 points, 2.419 kg gives 120, and 60 kg gives 2,000. A compatible
zero/nonpositive reduction gives zero; a missing or incompatible input remains
`unavailable`. There is no daily cap, race bonus or extra action scoring.

Factors must be uniquely selected for each used mode and their IDs retained in
the journey. In the absence of a declared cross-dataset compatibility contract,
this implementation accepts only a common geography/source/period/method across
used factors. That conservative local check is not scientific factor validation.
Different factor methods remain unavailable until the factor owner supplies
explicit compatible coverage; walking/cycling operational factors must not be
silently combined with a different lifecycle boundary.

Full calculation requires a finished arrival, recorded qualified endpoints,
`satisfies_configured_rules`, no contradictory reasons, and available assessed
legs. Multimodal distances cannot be invented from a single GPS total. Fallback
uses the retained selected route's expected whole award and `min(50, expected)`.
It requires recorded start and arrival and missing intervening evidence. For the
current assessment reasons that means `continuity_gap`, optionally accompanied
by `insufficient_movement`. Other ambiguity does not establish that condition.
Expected 120 gives 50; expected 20 gives 20. Fallback retains insufficient-evidence
status and never counts as validated distance or verified avoided emissions.
Unfinished settlement rejects with 409. Ineligible/expired or missing-endpoint
outcomes retain their reason with no automatic credit. An unavailable calculation
has no numerical estimate; the outcome's zero target/credit is only an accounting
no-op and must not be displayed as zero emissions.

## Transaction, authority and replay

`settleJourneyAward({pool, token, journeyId, input})` accepts only
`{profileId, requestId, assessmentVersion, assessmentRevision}`. UUIDs normalize
to lowercase. The caller cannot supply amount, actor, role, factor, assessment,
provenance or eligibility. `readJourneyAward({pool, token, journeyId})` returns
current assessment identity, cumulative automatic credit and latest retained
receipt to the current owner. Reads also recheck current session authority.

The mutation calls the existing `runPointsOperation` with `access: 'owner'` and
`kind: 'journey_settlement'`. Canonical intent binds journey, assessment version,
revision and server-only credit context. Lock order is existing current principal
and session authority, actor/request binding, owned profile, successful replay,
then the journey and its award state. The exact integrated journey call is:

```ts
lockJourneyForSettlement(
  client: PoolClient,
  principalId: string,
  profileId: string,
  journeyId: string,
): Promise<JourneySettlementProjection>
```

It receives the **same** transaction client from `perform`; it reacquires the
already-held profile lock before locking the journey. Awards neither invokes a
second journey transaction nor parses its private storage. After successful
replay lookup, a fresh operation checks finished state, trusted current assessment
identity, immutable Start basis and retained policy. New-key stale revisions
conflict. Reusing a successful key returns the original outcome even after later
evidence. Current authorization still precedes replay.

PR33's fresh database-clock check after the session authority lock is preserved.
Expiry while waiting for that lock rejects before replay. Expiry during a later
profile wait follows the accepted existing authorization-point semantics; awards
does not silently introduce a later expiry policy.

Automatic credit is `max(0, target - cumulativeAutomaticCredit)` for this journey.
Cumulative credit is independent of balance and manual corrections. New keys and
concurrent settlements serialize and cannot re-award that total. Later lower or
ineligible targets add zero without clawback. Same-key replay adds no History;
a new-key no-op records a clearly reasoned zero-delta operation under the existing
points contract. Retained receipts are unchanged by later revisions.

## Persistence and retention

`0008_journey_awards.sql` adds immutable `journey_award_assessments`, unique by
journey/assessment version/revision, and `journey_award_state`, unique per journey.
Each assessment links to its original `points_operations` row through a deferred
foreign key because the points runner inserts History after the callback. State
retains the latest receipt and cumulative automatic credit, constrained to
0..2,000 and prevented from decreasing or being deleted. Receipt updates,
deletes and truncation are rejected. No parallel balance ledger exists.

Receipts retain source/provenance, route applicability, earning/arithmetic and
factor versions, factor values/units/geography/source/period/method/assumptions,
same-query baseline legs, selected and assessed nonprecise legs, Start policy,
assessment identity/revision/status/calibration/reasons/endpoints/mode plausibility,
start/finish times and reason, calculation and award decision. They contain no
coordinates, route geometry or capture-session identifiers. Seven-day precise
cleanup leaves these calculation records and original outcomes usable. A late
revision keeps the same Start basis; a changed factor/policy alone is not evidence.

Callback state/receipt writes, balance and History commit together. The owned
real-PG tests observe row-lock waits, concurrent replay/top-ups and an overflow
failure after callback writes that rolls all four back. Manual debits do not
lower cumulative credit or permit another automatic award.

## Readiness and test-only accounting

The integrated projection currently permits only `calibration: 'unvalidated'`
and exposes indicative applicability, not a production applicability attestation.
Feature 03 approves no numerical factor. The public service therefore retains
calculations and no-credit outcomes with `productionCredit.kind: 'unavailable'`.
This preserves the accepted earning feature while its live-credit prerequisites
remain pending. There is no new human product approval flow or runtime bypass.

The narrow future owner handoff is a typed trusted calibration-validation status
bound to the retained assessment policy and a compatible, sourced, applicable
approved factor basis bound to the retained journey. It must explain how a later
validation is represented as a new trusted revision without rewriting receipts
or repricing historical factors. Awards can then accept that explicit readiness
variant; changing an environment flag or merely labelling provenance `live` is
insufficient. Physical locked-background iOS/Android proof remains separate.

`testing/service.ts` is an internal server test entry. It requires actual
`NODE_ENV=test` and the locked journey's explicit `source.kind: 'fixture'`.
It uses normal authentication, locks, replay and the real transaction. The public
HTTP adapter never imports it, accepts a callback override or forwards a test
flag. Tests prove development/production configuration and live provenance cannot
use this entry. Synthetic points are labelled as test credit with no physical
travel claim. The real journey module remains real-profile-only. Future #17
simulation needs its own trusted demo-only projection; it is not this fixture API.

## Future boundaries

Reset must preserve completed outcomes, History, receipts and cumulative automatic
credit. The future generation/cancellation hook belongs inside `perform`, after
successful replay and the profile lock, before fresh callback writes. An old
successful request keeps its outcome; a new-key request for cancelled pre-reset
work must reject. The reset owner must supply the trusted generation state and
coordinate its writers under the same profile lock. No generation schema or reset
implementation/proof is supplied here. Migration 0009 participation and 0010
reset remain separately owned.

#21 can consume nonprecise calculated kg/provenance once per real journey and
replace its contribution on reassessment; it cannot sum points, duplicate a
fallback/top-up or count manual corrections as emissions. Missing/incompatible
impact stays missing. #22 still owns assigned-admin future rules and effective
versions. This slice retains the initial Start version, not a configuration UI or
future rule publication. Neither child is implemented here.

## Registered API and checks

Owned runtime files are `server/awards/contracts.ts`, `decimal.ts`, `policy.ts`,
`operation.ts`, `store.ts` and `http.ts`; test-only files are `policy.test.ts`,
`awards.test.ts`, `http.test.ts`, `testing/fixtures.ts`, `testing/service.ts`,
`testing/api-process.ts` and `testing/registered-api.test.ts`.
The only schema addition is `server/database/migrations/0008_journey_awards.sql`.

The shared API registers only the public handler:

```ts
import { createAwardsHandler } from '../awards/http.ts';
// Once inside createApi:
const awards = createAwardsHandler({ pool });
// After existing origin/rate checks and const token = bearer(req):
const award = await awards({
  method: req.method,
  path,
  token,
  readBody: () => body(req), // existing JSON/object validation and 4 KiB limit
});
if (award) return send(res, award.status, award.body);
```

This handles `POST /v1/journeys/:journeyId/settlements` and
`GET /v1/journeys/:journeyId/award`, both status 200, with the existing error mapper.
Do not expose `executeSettlement` or `testing/service.ts`. Preserve origin/rate
limits, bearer extraction, no-store/security headers and request timeouts. The
retained actual 404 failures now pass through registered `createApi`. Separate
API process tests prove restart replay, incremental evidence, concurrent requests,
current-session denial, row-lock waits and transaction rollback. Public outcomes
remain credit-pending; positive fixture credit uses only the internal test entry.
Phone ownership remains separate; clients render assessment, calculation and
readiness distinctly and never infer physical proof.

The package and CI register:

```sh
pnpm awards:test
pnpm awards:test:database
```

Database tests require the isolated namespace selected by `scripts/local-db.mjs`
and refuse a non-test or different-worktree database. CI must provision its own
restricted disposable namespace, apply migrations including 0008, then run these
groups serially with the existing account/points/journey/submission/reward checks.
The database command runs the owned domain, HTTP and child API process suites
with file concurrency one. Local host fixtures use ephemeral loopback ports.
Process tests record PID/port plus awaited listener/pool shutdown; no persistent
service or shared database lifecycle is required.

The reviewed integration base includes PR35's precise FK/trigger denial and
rollback-only CASCADE checks with unchanged complete History rows. The original
`25add9e` SQLSTATE mismatch remains in private evidence. The receipt FK and shared
points tests are inherited unchanged; no awards-specific weakening is applied.

The #21 consumer must combine owner/profile kind, latest calculation receipt and
current assessment identity. A newer assessment than the receipt is pending and
excluded until settled; GET never writes a settlement. A later revision replaces
one journey's impact contribution even downward, without points clawback. Real
live completed assessed journeys remain distinct from synthetic, demo, fallback
or unavailable calculations. This contract does not implement impact totals or
add a second ledger; the current owner read returns identity/receipt and the
profile ID, with profile kind supplied by the account-owned projection.

Implemented by gpt-6-astra through Codex (T3 Code).
