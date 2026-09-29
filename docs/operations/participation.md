# Submission participation operations

Issues [#12](https://github.com/NachikethReddyY/AMR-Fan-App/issues/12) and
[#13](https://github.com/NachikethReddyY/AMR-Fan-App/issues/13) add contributions,
shared ranking and assigned-admin interaction sessions to the existing submission
module. [Fan submissions](../features/06-fan-submissions.md) owns product rules.

## Current delivery boundary

The domain, migration, seven HTTP routes and separate admin page are registered
in the actual API. Package/check and serial CI registration are included. The
retained actual API/static registration cases now pass, alongside real-process
restart and existing feature regressions. Shared navigation and phone controls
remain with their owners.

PR39 integrated participation into main. The hosted sign-in follow-up starts from
`1ea07e1b2d83ae148ed3e0817cd49cb1af395b38`. Its participation domain, migration,
original receipts, ranking and points/auth policy remain unchanged. Root dispatch
retains journey, awards, reports and the inherited Supabase configuration. The
owned admin page now uses the same hosted sign-in helper and conditional provider
CSP as main's other admin pages. Migration `0009_submission_participation.sql`
follows accounts, points, submissions, rewards, reports and awards migrations;
no existing migration is rewritten.

Independent review of the prior `f5d60a0` candidate found no actionable core code
finding and observed 320px, paging and visible keyboard focus. Native browser 200%
zoom remained a hold; audible assistive technology, phone and reset acceptance
were unverified. Those observations are historical. The follow-up changes the
sign-in assets and has no new browser proof or exact-head independent signoff.
Native 200% zoom is not inferred from CSS zoom or unit tests. CI remains paused by
the user; no Actions query, rerun or re-enable is part of this follow-up.

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
selection resolutions and `content: [{ id, text, tag }]` for selected submissions.
The content joins immutable originals so admin actions remain identifiable when
the live ranking page changes. It adds no owner/profile fields and does not
rewrite action receipts. This preserves previous selection/release cycles when a
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

## Registered API and remaining caller handoff

The registered imports in `services/api/api/app.ts` are:

```ts
import { handleParticipationRequest } from '../submissions/participation-http.ts';
import { serveParticipationAdmin } from '../submissions/participation-admin.ts';
```

Alongside existing static admin handlers, before bearer extraction:

```ts
if (
  req.method === 'GET' &&
  (await serveParticipationAdmin(path, res, adminAuth.mode === 'supabase'))
) return;
```

The exact asset allowlist is `/admin/participation/`,
`/admin/participation/app.js` and `/admin/participation/style.css`. The HTML also
uses the existing `/admin/style.css`. Keep the trailing slash on the page link.
No tests, TypeScript sources, directory traversal or arbitrary asset paths are
served. The handler sets same-origin script/style CSP and allows connections
only to self, plus the inherited fixed Supabase URL when configured for hosted
sign-in. It retains no-store and nosniff; the existing API retains its other headers. The separate shell owner
may register a link to `/admin/participation/` in the established navigation.
This author has not changed navigation.

After bearer extraction and existing origin/rate guards, before the generic
fallback, the API calls the adapter alongside the registered #11/journey/reward adapters:

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

Registered root scripts:

```json
{
  "participation:test": "node --test --test-concurrency=1 services/api/submissions/participation-contracts.test.ts services/api/submissions/participation-http.test.ts services/api/submissions/participation/admin/assets.test.ts services/api/submissions/participation/admin/app.test.mjs",
  "participation:test:database": "pnpm db:run-test -- node --test --test-concurrency=1 services/api/submissions/participation.test.ts services/api/submissions/participation/admin/read.database.test.ts services/api/submissions/participation-http.database.test.ts services/api/submissions/participation/admin/registration.database.test.ts"
}
```

The first runs in `check`. The full unfiltered second runs in the `local-postgres`
CI job immediately after `pnpm db:test`, before account/points/other feature
database suites. The domain suite and the focused admin-read fixture reset only
their canonical worktree
`_test` database's app/migration state between cases. Run it serially and before
other database regressions; never share that database with a concurrently running
suite. Do not use registration skip filters in CI.

The owned page implements create/close/release/fulfil controls using these routes,
with existing same-origin in-memory bearer authentication and current server role
checks. Root registration is complete. The
phone owner joins live status into Rewards History and exposes shared voting in
Redemption, preserving exactly two Rewards tabs and the four main destinations.
Show exact confirmed spend, freeze/refusal states and demonstration fulfilment.
No new visual direction or real fulfilment arrangement is selected here.

## Owned admin controls and browser acceptance

The page reuses the established admin sign-in, shared CSS, controls and list
geometry. Its small stylesheet extends wrapping for long IDs, decimal totals
and content. It uses native buttons, labelled select/textarea controls, polite
status output and explicit keyboard focus for close confirmation and recorded
results. A DOM test can prove those attributes and focus calls; it cannot prove
rendered overflow, assistive-technology behavior or visual quality.

The existing local account selector is available only when `/admin/config`
reports synthetic mode. Current `/v1/admin/session` gates entry and refresh;
every mutation and session/audit read also requires current backend authority.
When `/admin/config` supplies the inherited Supabase mode, the page binds the
shared `/auth/admin.js` email/password helper. It sends credentials only to the
fixed provider, exchanges the provider token for an app session, then checks
`/v1/admin/session` and reads `/v1/me` for the server-owned account ID. Both hosted
and synthetic entry use that account ID for pending-intent isolation. Password
inputs clear on submit; no token, refresh token or password is persisted. The
page retains current-role/session denial before replay. Requests omit cookies and
use a 10-second timeout and no-store. Local proofs use controlled provider
responses and real local JWT/session/HTTP/DB checks, with no hosted service call.

Ranking preserves the server's order, full decimal strings and microsecond
timestamps. It pages with the opaque `after` cursor; session history pages with
the decimal `before` cursor. Refresh replaces both first pages. The page does
not predict winners from a partial live ranking. Closing requires a separate
confirmation naming the session and the irreversible up-to-three freeze.

Original close snapshots and current resolution records are shown separately.
Empty snapshots are explicit. A selected entry has a reason of 1–500 characters
and release or demonstration fulfilment controls. Terminal entries show actor,
time and reason without another action. Immutable selected content is rendered
as text, as are reasons, tags, IDs and server messages; no HTML interpolation.

Double clicks cannot start a second in-flight action. An unknown outcome keeps
the exact path, payload and request ID in memory, scoped to that authenticated
actor. Only an explicit retry resends it. Refresh and reauthentication do not
replace it, even if the session has already closed or the selection resolved.
Another signed-in actor cannot view or replay that intent. A definitive input,
missing-target or conflict response requires a fresh read before new actions.
This is a temporary UI recovery guard, not a server session cap or new lifecycle.
An acknowledged result remains visible if its subsequent refresh fails.

Pending intents do not survive page reload or process termination. The page
warns against reload while an outcome is unknown. Server records remain durable;
after reload inspect current session/audit state before deliberately creating a
new action. No cross-reload automatic retry guarantee is claimed. Successful
creation receipts can say open while the current session is closed; the recorded
action and live list are deliberately separate.

For subsequent browser acceptance, use these exact assets and APIs with an
explicit browser grant against real `createApi`, never the owned test server:

1. Open `/admin/participation/` directly. Verify all three owned assets and shared
   CSS load with CSP/no-store headers. Sign in as a fan and then an assigned admin;
   verify denial versus entry. Revoke the role/session while open and prove data
   clears and writes are denied, including a retry of a completed request.
2. With approved synthetic contributions across question/activity tags, inspect
   huge totals and microsecond/equal-key ties in server order. Page both lists,
   refresh, and verify pending/rejected content and private profiles never appear.
   Use literal HTML-like text and reasons; verify no execution or unexpected URLs.
3. Create an open session, cancel close without a write, then confirm. Observe the
   original zero/fewer-than-three/three snapshot. Race a vote and competing close
   through the real API; show only the committed server result. Selected entries
   must reject new contributions; refreshed sessions must not replace winners.
4. Lose a create, close and resolution response while retaining the page. Retry
   the original action and inspect identical request ID/payload and one effect.
   Repeat after refresh and same-actor reauthentication; switch actor and prove
   no cross-actor pending details. A stale competing resolution should show the
   conflict and require refresh, without an automatic replacement action.
5. Release with a reason, contribute again and select in a later session. Verify
   retained earlier snapshots and audit. Record demonstration fulfilment and
   verify no further action/selection; show no claim of a real driver/team event.
6. Use keyboard only, including close/cancel, bounded reason validation and retry.
   At 320 CSS px and 200% zoom, inspect long text/IDs/totals, focus visibility,
   labels/status announcements and absence of horizontal overflow. Capture actual
   browser evidence. Phone/History and reset remain separate acceptance.

## Local proof and limits

Failing-first domain, asset, recovery and admin-read evidence is retained from
the original implementation. Root registration turned the retained API 404 and
static 401 cases green. The current serial unfiltered database suite passes all
20 cases: 15 domain, one immutable-content read, three registered HTTP/restart
cases and one actual static/API registration case. The 18 unit/asset/DOM cases
also pass. DOM fixtures remain tests, not substitutes for the browser.

```sh
pnpm participation:test
pnpm participation:test:database
```

Frozen install and every `pnpm check` stage pass. Node test files ran serially
through a private invocation wrapper; package dependencies and the lockfile were
not changed. Fresh regression passes include accounts 10, points 21, submissions 16,
rewards 21, journeys 17, route-provider 1, reports 21 and parser-container 3. Database
suites used only the isolated worktree test database and ran serially. The report
storage fixture first failed because macOS `/var` is a symlink; using its canonical
`/private/var` path fixed the fixture without changing source or security rules.
The pinned parser ran with the inherited bounded nonroot/no-network/no-mount
container contract, then its owned image and private report files were removed.

Source security passed: no leaks, zero findings across 143 SAST targets and
scanner self-tests passed. The dependency audit meets the configured high gate
but retains the moderate `uuid` advisory GHSA-w5hq-g745-h8pq. No dependency change
was authorized. One passive application scan started at `/admin/participation/`
using the actual API image in the existing isolated scanner environment. It had
zero blocking alerts and one informational 10109 notice. This unauthenticated
public-path scan does not prove authenticated admin authorization or replace the
HTTP/browser checks. Scanner implementation, rules and isolation were unchanged.

Actual T3 browser observations used the exact registered page and real PostgreSQL:

- Fan denial, assigned-admin entry, current role revocation during an explicit
  successful-action replay, and revoked-session write denial cleared private UI.
- Create/open, cancel without a close write, and keyboard confirmation produced
  empty, two-item and three-item original snapshots.
- Live ranking and the three-item snapshot retained decimal 4294967294 totals,
  microsecond approval order and numeric sequence order on exact ties. Zero-vote
  backlog was excluded. Shared question/activity content stayed in one process.
- Controlled response loss occurred after actual create, close and release
  commits. Refresh and same-actor reauthentication preserved the exact key/body;
  explicit retries returned original records. A different actor could not see or
  retry the pending intent. A competing terminal resolution returned 409.
- Selected-item contributions were denied. Release retained old snapshot 20 while
  a later contribution and session snapshot showed 30. Demonstration fulfilment
  stayed terminal and labelled; raw HTML-like text/reasons rendered literally.
- Close confirmation received focus; successful results received focus; inspected
  form controls had labels. Full keyboard-only operation and announcement behavior
  have not been established.

The T3 host became unavailable during the 320px resize and explicitly prohibited
retry. The saved desktop sign-in screenshot was inspected, but 320px/200% zoom and
workspace visual overflow remain unverified. Resume these checks when the manager
allocates a connected browser. Paging is covered by domain/DOM tests, not this
bounded browser run. Concurrency, lock waits, profile isolation, immutable History
and rollback/restart claims come from actual PostgreSQL/HTTP tests, not from the
single browser session. Full independent candidate review remains separate.

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
