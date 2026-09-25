# Submission participation operations

Issues [#12](https://github.com/NachikethReddyY/AMR-Fan-App/issues/12) and
[#13](https://github.com/NachikethReddyY/AMR-Fan-App/issues/13) add contributions,
shared ranking and assigned-admin interaction sessions to the existing submission
module. [Fan submissions](../features/06-fan-submissions.md) owns product rules.

## Current delivery boundary

The owned domain, migration and HTTP adapter have local PostgreSQL and adapter
proof. Root API registration, scripts/CI registration and admin/phone controls
are reserved to the integration owners and are not changed here. The retained
`actual createApi registers participation routes` test currently fails with 404
instead of 201. Passing owned adapter tests do not establish a registered product
flow. Browser, native, reset and deployment acceptance remain unverified.

The implementation base is reviewed main
`a7696eac5f521b7e718ccba8de173b207e2f5c58`. No shared module, original submission
receipt, moderation row or prior migration is changed. Migration
`0009_submission_participation.sql` follows reserved 0006 rewards, 0007 reports
and 0008 awards. Migrations 0002 accounts, 0003 points and 0005 submissions must
be present. The migration runner applies existing filenames in sorted order;
this worktree does not invent or apply peer migrations.

## Contribution and current status

`contributeToSubmission` receives the verified-session token, owner profile ID,
submission ID and strict `{ requestId, points }` input. Points are whole integers
from 10 through the existing per-profile storage bound of 2,147,483,647. The
locked available balance is the actual spending limit; there is no daily or
per-submission vote cap. Each new intentional contribution has a new request ID.
Questions and activities share the same rules. The 500-point fee is never a vote.

`runPointsOperation` owns current authorization, request serialization, profile
ownership/locking, immutable successful replay, balance arithmetic and History.
The contribution callback uses its transaction client and operation UUID. It
checks approved/unselected/unfulfilled eligibility, inserts the contribution and
returns the negative delta and receipt. Insufficient funds, a domain error or a
later ledger failure rolls back both effects. There is no standalone vote or
client-controlled balance mutation. The stored fingerprint binds profile, kind
and the canonical `[submissionId, points]` intent. UUIDs are normalized first.
Reusing a key with another amount, target, profile or kind conflicts.

Current authorization precedes replay. A successful replay returns the original
entry and contribution receipt even after selection or fulfilment, without
rerunning new-operation eligibility. A new request to a selected or fulfilled
submission is refused. No refund follows selection, release or nonselection.

`readSharedSubmissions` exposes only approved text/tag, stable submission UUID,
server approval time, decimal-text contributed total, lifecycle status and the
`demonstration` fulfilment label. It omits profile/owner/voter IDs, session IDs,
admin identities and private ledger records. Selected and fulfilled rows remain
visible with explicit status, but only backlog rows can receive new votes.
`readOwnSubmissionParticipation` validates profile ownership, including for an
admin using an owner route, and joins each owned fee/vote operation ID to its
submission ID, moderation and live participation. It orders by numeric points
sequence and supports the same bounded History pagination.

The #11 exports `submission`/`Submission` and their `rankingPoints: 0` remain
unchanged. Creation receipts are historical outcomes. Their `moderatedAt` field
is the immutable decision time; participation exposes it as `approvedAt` only
for approved submissions. Callers must read the participation projection for
live totals and selected/fulfilled status, and join History by operation ID.
They must not overwrite receipts or display the historical zero as a live total.

Totals use `SUM(points::numeric)` and JSON decimal strings. Sorting occurs in
PostgreSQL, never by JavaScript floating-point or text comparison. Required
ordering is total descending, then approved `decided_at` ascending at full
microsecond precision. The approved final implementation tiebreaker, only when
both keys are equal, is immutable numeric submission `sequence ASC`. Tags never
reserve places. Ranking pages default to 25, maximum 100; a bounded opaque
cursor retains all three ordering values. A live ranking can change between
pages, so refresh after mutations. Session closure ranks the complete eligible
set in one transaction, independently of pagination.

## Sessions and resolutions

`createInteractionSession` accepts only `{ requestId }`, requires a current
assigned admin and creates a stable server UUID, creator/time and open state.
Creation is opening. A matching retry returns the same original open receipt,
even if the live session has since closed. Read current state from the admin
session list. There are no drafts, schedules, automatic next sessions, reopening
or concurrent-session caps.

`closeInteractionSession` requires an existing session ID and `{ requestId }`.
It selects up to three approved unfinished positive-total submissions across all
tags, records their order/total/approval timestamp, and atomically closes that
session. Zero eligible records yields an empty closed session. Selected records
are frozen against further contributions and other sessions. Unselected records
retain contributions and eligibility. Repeated close, including a new key,
returns the original close snapshot, even after resolution. It never chooses
replacement winners for that same session.

`resolveSubmissionSelection` takes a selection ID and
`{ requestId, action: "release" | "fulfil", reason }`. Release restores backlog
eligibility and preserves all contributions. Fulfil records a demonstration
answer/activity and excludes the submission from further voting or selection.
There is no client field to claim real-world fulfilment. Resolution records the
admin, server time and bounded reason. A matching retry returns its stored result;
a conflicting payload or another new resolution of a terminal selection fails.

`listInteractionSessions` returns the original closed snapshot alongside current
selection resolutions. This preserves previous selection/release cycles when a
later session chooses a released submission again. Current admin authorization
is required for session audit reads as well as writes. No zero-value personal
points entry substitutes for the separate admin action audit.

The migration makes contribution and admin-action rows immutable. Session rows
can only close once; selection rows can only resolve once without changing their
original ranking snapshot. Foreign keys restrict deletion, and one partial
unique index excludes duplicate current selected/fulfilled records. These checks
protect normal application writes, not a privileged schema owner changing rules.

## Lock and authority order

Contribution uses points' principal SHARE, session SHARE, actor/request advisory
key and owned profile UPDATE before entering the callback. A new callback takes
one feature-wide transaction advisory lock
`hashtextextended('fan-submission-participation:v1', 0)`, then the submission row.
Admin actions take current authority, their actor/request key, then that same
feature lock, session row and submission rows in UUID order. Admin actions never
lock a payer profile. #11 moderation's authority-to-submission order is unchanged.

The common feature lock serializes contributions, close and resolutions. A vote
committed before close affects the snapshot. A close that selects the target
first makes a waiting new contribution fail without a debit. Concurrent sessions
cannot select the same still-selected submission. An approval after the close's
candidate query can enter a later session; approval cannot remove an existing
immutable approved decision.

Like reviewed points and #11, admin/read authorization rechecks database-clock
expiry immediately after the initial session authority row lock. This covers an
unchanged row whose predicate was evaluated before a lock wait. It does not add a
new expiry policy for later profile/domain waits. Role/session changes serialize
against held authority locks; a revocation committed before authorization wins
causes denial. No client role, badge or actor field grants authority.

## Exact registration handoff

The reserved root/API owner adds this import to `server/api/app.ts`:

```ts
import { handleParticipationRequest } from '../submissions/participation-http.ts';
```

After bearer extraction and existing origin/rate guards, before the generic
fallback, call the adapter alongside the registered #11/journey/reward adapters:

```ts
const participationResult = await handleParticipationRequest({
  pool,
  token,
  method: req.method,
  path,
  query: Object.fromEntries(new URL(req.url ?? '/', 'http://api.invalid').searchParams),
  body: () => body(req),
});
if (participationResult)
  return send(res, participationResult.status, participationResult.value);
```

Retain actual API 4,096-byte JSON, origin/rate, no-store/security-header and error
handling. The owned test server is test-only and must never be registered as an
alternate production API.

| Method and path | Request/result |
| --- | --- |
| `GET /v1/submissions/ranking` | Optional `after`, `limit`; authenticated shared projection |
| `GET /v1/profiles/:id/submission-participation` | Optional `before`, `limit`; owned operation/status joins |
| `POST /v1/profiles/:id/submissions/:submissionId/contributions` | `requestId`, `points`; 201 original entry/receipt, also on replay |
| `GET /v1/admin/submission-sessions` | Optional `before`, `limit`; current admin session snapshots/resolutions |
| `POST /v1/admin/submission-sessions` | `requestId`; 201 original open receipt |
| `POST /v1/admin/submission-sessions/:id/close` | `requestId`; 200 original close snapshot |
| `POST /v1/admin/submission-selections/:id/resolve` | `requestId`, `action`, `reason`; 200 recorded resolution |

Invalid input is 400, invalid/revoked/expired initial session 401, non-admin 403,
absent/private unavailable target 404, unsupported method 405 and funds,
eligibility, terminal-state or payload-key conflict 409.

Proposed root scripts, for the separate integration grant:

```json
{
  "participation:test": "node --test --test-concurrency=1 server/submissions/participation-contracts.test.ts server/submissions/participation-http.test.ts",
  "participation:test:database": "pnpm db:run-test -- node --test --test-concurrency=1 server/submissions/participation.test.ts server/submissions/participation-http.database.test.ts"
}
```

Add the first to `check`, and the full unfiltered second to the `local-postgres`
CI job immediately after `pnpm db:test`, before account/points/other feature
database suites. The domain suite resets only its canonical worktree
`_test` database's app/migration state between cases. Run it serially and before
other database regressions; never share that database with a concurrently running
suite. The explicit temporary pre-registration filter below is not a CI command.

The admin-shell owner wires create/close/release/fulfil controls to these routes,
with existing same-origin in-memory bearer authentication and current server role
checks. No admin assets or navigation are delivered by this domain slice. The
phone owner joins live status into Rewards History and exposes shared voting in
Redemption, preserving exactly two Rewards tabs and the four main destinations.
Show exact confirmed spend, freeze/refusal states and demonstration fulfilment.
No new visual direction or real fulfilment arrangement is selected here.

## Local proof and limits

The recorded failing-first runs initially fail on absent owned modules. Input
schemas then pass three cases. Fifteen real PostgreSQL cases cover minimum and
repeat votes, concurrent spending, exact tie order, private real/demo state,
rollback, immutable receipts/audit, session transitions, concurrent close/vote,
current revocation and unchanged initial-session expiry waits. A separate control
preserves valid authorization across a later profile wait. One owned adapter
boundary test and two real HTTP/owned-process-restart cases pass. Existing points
and #11 suites pass against migration 0009, including their immutable TRUNCATE
checks. Ten account/API regression cases also pass. The actual registered API
case remains intentionally red until integration.

The repository's `check` stages pass with test files run serially. Source secret
and SAST scans and scanner self-tests pass. The dependency audit meets the
configured high-severity gate, but still reports one moderate `uuid` advisory,
GHSA-w5hq-g745-h8pq, in the unchanged dependency graph. Dependencies are outside
this slice. These local checks are not independent candidate review or DAST.

```sh
node --test --test-concurrency=1 server/submissions/participation-contracts.test.ts server/submissions/participation-http.test.ts
pnpm db:run-test -- node --test --test-concurrency=1 server/submissions/participation.test.ts
pnpm db:run-test -- node --test --test-concurrency=1 --test-skip-pattern='actual createApi registers' server/submissions/participation-http.database.test.ts
```

After registration, remove only the invocation filter and run the complete suite
plus relevant account/points/#11 regressions. Verify the actual application body,
origin, auth and error guards. Then obtain browser/device/DAST grants for the
visible fan/admin loop and the native Rewards/History integration. A test-only
HTTP server, typecheck or passive unauthenticated scan cannot prove those paths.

Two local vote samples each used one request, 526 response bytes, zero provider
calls and roughly 13–15 ms. This tiny warm loopback sample is not a production
latency or throughput claim. The feature-wide lock is intentionally simple;
measure contention if realistic load requires more concurrency. Shared ranking
sums contributions on read; it has no background worker or AI/model dependency.

## Reset integration remains pending

#17/#18 own simulation and demo reset. No reset generation exists here. A future
fresh-confirmation check must run inside a new contribution's points callback,
after current ownership/profile locking and successful replay lookup, before
writing a new contribution. Its accepted confirmation value must be bound into
a versioned new intent without rewriting legacy fingerprints or successful
outcomes. Completed legacy replay remains valid; new stale confirmations must
be denied through the real reset contract. Do not add an always-zero generation.

Reset must preserve all completed contributions, shared totals, submissions,
active/resolved selections, purchases and History. Only the selected demo
profile's remaining balance resets with a new reason-recorded entry. No test here
claims to exercise reset, stale-confirmation races or preserved reward access.
Those require the actual #17/#18 implementation; directly clearing a test balance
is not reset proof. No synthetic journey, live identity provider, deployment or
real driver/team arrangement is introduced.

Prepared by gpt-6-astra through Codex (T3 Code).
