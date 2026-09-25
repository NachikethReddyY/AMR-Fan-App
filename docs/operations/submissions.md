# Fan submission operations

Issue [#11](https://github.com/NachikethReddyY/AMR-Fan-App/issues/11) owns paid
submission and assigned-admin moderation. Product rules remain in
[fan submissions](../features/06-fan-submissions.md). Questions and proposed
activities use one process. The optional tag is descriptive and never changes
the fee, authority or future ranking eligibility.

## Current candidate

The actual API registers submission, owner reads, terminal admin decisions and
the separate `/admin/submissions/` page. Real fan-to-admin-to-fan HTTP and actual
process-restart tests pass. Browser proof used synthetic accounts in the own
dev database, with current server-assigned admin authority and the leased API.
The module refresh is based on reviewed main
`8e346aff606771662312697effe8fbff1742f131`. The repaired points History query
passes its numeric digit-boundary/pagination regression and the unchanged
submission newest-first assertions. Original failing evidence is retained
privately. The narrowly authorized shared points test now accepts the precise
foreign-key `0A000` denial as well as the immutable trigger's `23514` denial for
plain `TRUNCATE`. A second, always-rolled-back probe includes FK dependents to
reach the actual points trigger and requires its exact `23514` error. Complete
stored points rows, including outcomes, must serialize identically before and
after each probe. UPDATE/DELETE trigger checks remain unchanged; independent
final review must include this test compatibility change.

## Atomic payment and ownership

`createSubmission` uses the reviewed `runPointsOperation` with owner access.
The server fixes the fee at 500, records the `fan_submission` debit and inserts
the submission using the same transaction client. The deferred foreign key to
the points operation checks the complete operation at commit. Insufficient
balance or any write failure rolls back content and accounting together.

The caller confirms `confirmedFee: 500` and supplies a UUID `requestId`, text,
an optional tag and an optional rejected `resubmissionOf` UUID. Text is trimmed,
limited to 1–1,600 characters and rejects unsafe control/directional characters.
Line breaks and tabs are allowed. Tags are `question`, `activity`, `other`, or
null. No upload, owner, balance, approval or ranking field is accepted.

Successful replay returns the original debit and submission receipt, even if
the submission has since been reviewed. Reusing the same key with a different
profile or payload returns a conflict. Read current moderation status through
the owner's submission list; do not interpret the original receipt's pending
status as the current decision. `pointsOperationId` joins current status to the
immutable History entry without rewriting the debit.

Owners can read their own real and demo submissions. An admin role does not
grant access through another owner's route; assigned admins use the separate
review endpoint. Balances and personal History remain separate. Re-signing in
resumes the same persistent profile and submission records.

## Moderation and later consumers

Only a current server-assigned admin with a valid session can read the review
queue or approve/reject. The transaction holds current principal/session locks,
then serializes the admin request key and submission. Pending can become
approved or rejected once. A matching retry returns the decision; conflicting
keys, opposite decisions and another review of a terminal record fail.

After acquiring the initial session authority lock, the module checks expiry
against the database clock again. PostgreSQL can evaluate the locking query's
predicate before waiting for an unchanged row. Controlled tests prove that
expiry during that wait denies both fresh decisions and replays with 401 and
preserves submission status and History. Valid-session controls still succeed.
This check does not redefine session timing during later domain/profile waits.

The immutable submission keeps its server UUID, owner profile, original text,
tag, fee, creation sequence/time and points operation ID. A separate immutable
decision records admin, request key, status and server time. Submission or
decision updates, deletes and truncation are rejected. These safeguards protect
normal application writes, not a privileged database administrator altering the
schema.

A rejected resubmission is a fresh confirmed purchase with a new request key
and submission UUID. Its optional link must reference that profile's rejected
submission. It pays 500 again, preserving the original rejection and fee.
Approval, rejection and an unanswered submission produce no refund or award.
Approval does not guarantee an answer or activity.

Issue #12 owns contributions and ranking. Original #11 creation receipts report
zero ranking and remain immutable. A future current-participation read must
combine live contributions and eligibility separately, without rewriting those
receipts. The fee is never a contribution. Issue #13 owns selection and fulfilment.
Future records can reference the stable submission UUID and use the approved
decision time for the accepted earlier-approval tie rule. No vote, session,
selection, fulfilment or upload endpoint is implemented here.

## HTTP registration

The shared API supplies its bounded JSON reader, origin/rate checks and error
handling to `handleSubmissionRequest`. `serveSubmissionAdmin` serves the owned
page and script; the existing `/admin/style.css` supplies the accepted admin
presentation. These are same-process modules, not separate deployed services.

`server/api/app.ts` imports `handleSubmissionRequest` from
`../submissions/http.ts` and `serveSubmissionAdmin` from
`../submissions/admin.ts`. GET asset handling preserves the existing
`serveAdmin`. After `bearer(req)` and existing origin/rate guards, it passes
`{ pool, token, method: req.method, path, query, body: () => body(req) }` to the
submission handler. `query` comes from the request URL's search parameters.
A non-null result uses the existing `send(res, result.status, result.value)`;
otherwise existing routes continue. The shared body reader retains its
4,096-byte limit, and route-provider registration remains intact.

Root scripts are `submissions:test` for
`node --test server/submissions/http.test.ts` and `submissions:test:database`
for `pnpm db:run-test -- node --test server/submissions/submissions.test.ts`.
The first runs in the normal check command; the full database suite runs in the
PostgreSQL CI job. No filtered handoff command is registered in CI.

| Endpoint | Request | Result |
| --- | --- | --- |
| `POST /v1/profiles/:id/submissions` | Confirmed submission input | 201 with original points entry and submission receipt |
| `GET /v1/profiles/:id/submissions` | Optional `before` sequence, `limit` 1–100, default 25 | Current owned submissions, newest first, and next cursor |
| `GET /v1/admin/submissions` | Same pagination; `status` pending/approved/rejected, default pending | Current assigned-admin review list |
| `POST /v1/admin/submissions/:id/decision` | UUID `requestId`, status approved/rejected | 200 with the recorded current decision |
| `GET /admin/submissions/` | None | Separate admin review page; data/actions require assigned-admin session |

The page keeps its token in memory, renders submission content with
`textContent`, and retains a retry key for an unchanged decision during that
page visit. Reload requires sign-in again. The local synthetic flow uses the
existing account fixtures and trusted operator role assignment. No page grants
itself authority. Live browser sign-in remains dependent on the identity setup.

## Local verification

Use only this worktree's provisioned database pair and leased service resources.
The database owner controls provision/reset/restart; tests do not reset the
service or touch peer databases. Tests add synthetic records in the owned
disposable test database.

```sh
node --test server/submissions/http.test.ts
pnpm db:run-test -- node --test server/submissions/submissions.test.ts
```

Input and database policy tests cover the 600-to-100 case, concurrent retries and
spending, rollback, owner denial, moderation races, current role/session
revocation, retained rejection fees and paid resubmission, and persistent
real/demo ownership. HTTP registration and process-restart tests pass through
the actual API. The original pre-registration 404 failures remain in private
evidence, along with the former numeric History-order and session-expiry failures.
The owned asset test observes HTTP content types, the CSP and path allowlisting;
it does not inspect rendered interaction.

Passive ZAP 2.17.0 scans used the actual API and PostgreSQL in disposable
containers on an internal network with no host-published ports. The normal root
scan reported no alerts. An explicit `/admin/submissions/` scan reported eight
GET endpoints and only informational `10109` (Modern Web Application); no
medium/high findings occurred. A diagnostic repeat traced internal log errors
to blocked scanner telemetry/update DNS requests. The scan reached public page,
script and stylesheet content without signing in. It does not prove protected
queue/decision coverage or account isolation; real HTTP tests cover those paths.

## Browser proof and fixture procedure

Observed with T3 preview and the actual registered API: fan access denial,
admin sign-in/queue, question approval, activity rejection, literal hostile text,
long-text wrapping at 375 CSS pixels, 44-pixel controls, keyboard focus/refresh,
same-key replay after a controlled lost response, and a competing-review conflict.
Owner HTTP reads then confirmed unchanged original debits, all four decisions,
and one new paid resubmission with no extra debit on retry.

The preview host became unavailable during later filter inspection. The supported
fallback listed no browsers and could not create an in-app tab. Approved/rejected
filter rendering and live role revocation in the browser remain unverified;
current revocation is covered by real HTTP/database tests. Saved screenshots
are private. The owned T3 tab close request succeeded; renderer cleanup could
not be observed after host loss. The fixed API stopped and fixture admin rights
were revoked through the trusted command.

For an authorized repeat, use only the own dev database and assigned loopback
API/admin port. Keep model/provider flags disabled and use the existing synthetic
identity issuer `urn:amr:local-synthetic`.

1. Migrate the own dev database. Start the actual
   API with `AUTH_DEV_ENABLED=true`, `API_HOST=127.0.0.1`, the leased `API_PORT`,
   and matching `ADMIN_ORIGIN=http://127.0.0.1:<leased-port>`. Use the documented
   `pnpm db:run -- pnpm api:start` launcher. Do not start a substitute server.
2. Obtain local `fan-a` and `fan-b` sessions through `POST /v1/dev/session`.
   Keep tokens only in process/page memory, never evidence. Use the returned
   principal ID for A and the trusted account role-assignment command to grant
   A admin rights with a synthetic-fixture reason. Do not infer IDs or grant
   privileges through HTTP fields. B remains an ordinary fan.
3. Through A's points-adjustment endpoint, bring B's selected real profile to
   exactly 600 with a recorded fixture reason. Use observed current balance;
   do not reset accounts or replace existing History. B submits a question with
   `confirmedFee: 500`, a new request UUID and text such as
   `How do you prepare? <img src=x onerror=alert(1)>`. Assert 100 remaining,
   pending status, zero original ranking and the linked debit.
4. With T3 preview, open `/admin/submissions/` and sign in as A. Observe the
   literal fixture text, pending status, and accessible Approve/Reject controls.
   Approve, then read B's current status and unchanged fee through the real API.
   Check reviewed state in the page and take sanitized evidence without tokens.
5. Bring B to 600 through a reasoned fixture adjustment, submit a proposed
   activity tagged `activity`, and reject it. Restore B to 600 through another
   reasoned adjustment, then resubmit with a new request UUID and
   `resubmissionOf`. Observe the new 500-point charge and both retained records.
   Demonstrate retry without another charge.
6. Sign in as B on the admin page and verify denial. Revoke A's role through the
   trusted command while its page is open and verify protected refresh/decision
   denial. Finish fixture role cleanup and stop only the leased API process.

The API-driven fan setup plus actual admin page proves the server/admin path
only. Phone confirmation, native History and assistive-technology acceptance
remain pending their own granted devices and source integration.

## Remaining full-issue acceptance

- Repeat the observed registered fan HTTP to admin browser to owner-status path
  through phone Rewards and History after the held phone work integrates.
  The phone form must show the new non-refundable 500-point fee
  before each submission/resubmission and explain that approval promises no
  fulfilment. Rewards retains exactly Redemption and History tabs.
- Verify native iOS and Android interaction, small-iPhone layout, large text and
  VoiceOver. Existing devices with unknown ownership remain untouched. No
  physical-device or cloud claim follows from loopback tests.
- Integrate with the future demo-reset owner: completed submissions, History,
  shared contributions and selections survive; unfinished confirmations become
  stale; completed replay remains valid. There is no reset operation or invented
  reset epoch in this candidate. Actual reset proof remains pending.
- Complete the two browser observations limited by preview availability.
  Passive public crawling does not establish authenticated authorization,
  accounting or full protected-route coverage; retain the authenticated tests.

Laya remains optional advisory infrastructure, disabled by default. This module
does not call a model. Advisory availability or quality cannot block an ordinary
admin decision or authorize approval, points or access. No paid account, provider
provisioning or deployment is part of this candidate.

Written by gpt-6-astra through Codex (T3 Code).
