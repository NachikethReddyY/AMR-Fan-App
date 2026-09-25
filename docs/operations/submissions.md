# Fan submission operations

Issue [#11](https://github.com/NachikethReddyY/AMR-Fan-App/issues/11) owns paid
submission and assigned-admin moderation. Product rules remain in
[fan submissions](../features/06-fan-submissions.md). Questions and proposed
activities use one process. The optional tag is descriptive and never changes
the fee, authority or future ranking eligibility.

## Current candidate

The owned PostgreSQL module and request adapter implement submission, owner
reads and terminal admin decisions. Shared API registration and actual admin
browser verification are pending the serialized integration grant. Do not treat
the presence of the owned page or passing module tests as a complete HTTP flow.
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

## Intended HTTP registration

The shared API supplies its bounded JSON reader, origin/rate checks and error
handling to `handleSubmissionRequest`. `serveSubmissionAdmin` serves the owned
page and script; the existing `/admin/style.css` supplies the accepted admin
presentation. These are same-process modules, not separate deployed services.

In `server/api/app.ts`, import `handleSubmissionRequest` from
`../submissions/http.ts` and `serveSubmissionAdmin` from
`../submissions/admin.ts`. The GET asset handling must preserve the existing
`serveAdmin`. After `bearer(req)` and existing origin/rate guards, pass
`{ pool, token, method: req.method, path, query, body: () => body(req) }` to the
submission handler. Derive `query` from the request URL's search parameters.
Send a non-null result through the existing `send(res, result.status,
result.value)`; otherwise continue existing routes. Preserve the route-provider
registration and any journey registration present at the manager's transfer.

During that same grant, add root scripts `submissions:test` for
`node --test server/submissions/http.test.ts` and `submissions:test:database`
for `pnpm db:run-test -- node --test server/submissions/submissions.test.ts`.
Add the first to the normal check command and the full database suite to the
PostgreSQL CI job. Never register the filtered handoff command in CI.

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

For the bounded pre-integration module handoff, explicitly exclude only the two
tests that need shared registration:

```sh
pnpm db:run-test -- node --test --test-skip-pattern='real API registers|actual API process shutdown' server/submissions/submissions.test.ts
```

Input and database policy tests cover the 600-to-100 case, concurrent retries and
spending, rollback, owner denial, moderation races, current role/session
revocation, retained rejection fees and paid resubmission, and persistent
real/demo ownership. HTTP registration and process-restart tests deliberately
remain failing until the real API registration lands. Keep the captured
pre-registration failure as acceptance evidence.
The owned asset test observes HTTP content types, the CSP and path allowlisting;
it does not inspect rendered interaction.

## Prepared browser fixture procedure

This procedure is prepared for the later registration/service/preview grant;
it has not been run by the module refresh. Use only the own dev database and
the assigned loopback API/admin port. Keep model/provider flags disabled and
use the existing synthetic identity issuer `urn:amr:local-synthetic`.

1. Migrate the own dev database once registration is available. Start the actual
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

- Observe the actual registered fan HTTP to admin browser to owner-status path,
  then repeat it through phone Rewards and History after the held phone work
  integrates. The phone form must show the new non-refundable 500-point fee
  before each submission/resubmission and explain that approval promises no
  fulfilment. Rewards retains exactly Redemption and History tabs.
- Verify native iOS and Android interaction, small-iPhone layout, large text and
  VoiceOver. Existing devices with unknown ownership remain untouched. No
  physical-device or cloud claim follows from loopback tests.
- Integrate with the future demo-reset owner: completed submissions, History,
  shared contributions and selections survive; unfinished confirmations become
  stale; completed replay remains valid. There is no reset operation or invented
  reset epoch in this candidate. Actual reset proof remains pending.
- Run the actual HTTP target through isolated DAST after registration. Passive
  public crawling does not establish authenticated authorization, accounting or
  full protected-route coverage; retain the authenticated business tests.

Laya remains optional advisory infrastructure, disabled by default. This module
does not call a model. Advisory availability or quality cannot block an ordinary
admin decision or authorize approval, points or access. No paid account, provider
provisioning or deployment is part of this candidate.

Written by gpt-6-astra through Codex (T3 Code).
