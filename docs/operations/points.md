# Points operations

Issue [#5](https://github.com/NachikethReddyY/AMR-Fan-App/issues/5) adds persisted
whole-integer balances, assigned-admin adjustments and immutable History. Product
meaning remains in [Points and history](../features/05-points-and-history.md).
Phone History is prepared in the held account candidate; native acceptance is
pending. Live email/browser sign-in is not demonstrated by the local synthetic flow.

## Local admin flow

Use an infrastructure-provisioned worktree database pair and leased API port.
The [account procedure](accounts.md) supplies synthetic identities and the
trusted operator command to assign an already-created principal the admin role.
The page does not create roles or grant admin access.

```sh
pnpm db:migrate
pnpm db:migrate --test
pnpm points:test:database
AUTH_DEV_ENABLED=true API_HOST=127.0.0.1 API_PORT=<leased-api-port> ADMIN_ORIGIN=http://127.0.0.1:<leased-api-port> pnpm db:run -- pnpm api:start
```

Open `/admin/` on that same origin, sign in as the assigned test admin, select a
profile, and enter a signed integer adjustment and reason. The page displays the
server balance and newest History entries. Real and demo profiles are separate
targets. Insufficient funds leave the balance and History unchanged. Sign-out or
authorization failure hides the account workspace. Tokens stay in page memory;
reload requires sign-in again. Unchanged retries in the page reuse their request
key; durable retry across a page reload is not implemented.

Without synthetic mode, the page reports that admin sign-in setup is pending.
A production browser authentication flow still needs the selected identity
provider. `ADMIN_ORIGIN` alone does not supply authentication.

## HTTP boundary

All endpoints require the existing opaque account session as a bearer token.
The server derives the actor, current role and session validity. Only the admin
endpoints permit a target outside the actor's own profiles.

| Endpoint | Input | Result |
| --- | --- | --- |
| `GET /v1/admin/points/profiles` | Optional `after` profile UUID | Up to 50 profiles and `nextCursor`; current admin required |
| `POST /v1/admin/points/adjustments` | `targetProfileId`, UUID `requestId`, signed integer `delta`, `reason` | 201 with the immutable History entry, including on successful replay |
| `GET /v1/profiles/:id/points/history` | Optional `before` sequence and `limit` 1–100, default 25 | Owned profile, current balance, newest-first entries and `nextCursor` |
| `GET /v1/admin/profiles/:id/points/history` | Same pagination | Same result for an assigned admin's selected target |

An adjustment must be nonzero, within ±2,147,483,647, and leave a balance between
zero and 2,147,483,647. The trimmed reason is 1–500 characters with no control
characters. Unknown fields, including supplied actor, role or balance, fail with
400. Missing/expired/revoked sessions fail with 401; a non-admin receives 403;
an unavailable owned profile receives 404. Insufficient funds, overflow, or a
request key reused for a different target/payload returns 409.

History records the actor UUID, target profile, signed delta, resulting balance,
reason, operation kind and server UTC time. Pagination uses a sequence string,
not client timestamps. Corrections append another entry.

## Phone consumer

Home, the account sheet and Rewards share the selected profile's current balance
from `GET /v1/profiles/:id/points/history`. The phone asks for 25 entries per page,
validates the response and passes `nextCursor` back as the opaque `before` string.
It preserves server order and never sums entries to calculate a balance. Each
row displays the signed change, reason, resulting balance and server timestamp.
Redemption and History remain the two sections inside Rewards; purchase and
reward-status integrations are not implemented by this slice.

Account/profile changes, logout and session expiry clear the in-memory History.
Generations ignore responses from replaced requests. Nothing from History is
written to SecureStore. Foreground resume and opening Home, Rewards or the account
sheet refresh the current page. A failed refresh hides old values and offers retry;
a failed later page retains only the current profile's already loaded entries.
Refresh starts again at the newest page, including entries added during pagination.
Large balances and sequence strings retain their server values.

Run the focused state proof and the actual API adapter proof with an operations
port lease and the worktree's disposable test namespace:

```sh
pnpm exec jest src/features/account/session.test.ts src/features/points/history.test.ts --runInBand
API_PORT=<leased-api-port> pnpm db:run-test -- node --test src/features/points/testing/http-proof.ts
```

The HTTP proof creates unique controlled identities, assigns only its synthetic
admin through the trusted server function, and makes all balance changes through
the existing admin HTTP endpoint. It covers two pages, real/demo and cross-account
isolation, maximum balance, API/pool restart, outage recovery, durable logout and
expiry. Immutable fixtures remain in that disposable test database. Its storage
stand-in tests controller restart, not native SecureStore or a real device restart.

New balance/History UI interaction, normal/largest-text rendering and device
accessibility remain **unverified** until an explicit device ownership lease is
resolved. Prior Android account/tab proof applies only to unchanged code lineage.
Small-iPhone largest Dynamic Type and actual VoiceOver remain mandatory; neither
Android nor iPad substitutes for them. Live OIDC provisioning is separately pending.

## Atomic integration contract

`server/points/index.ts` exports `runPointsOperation` for trusted server callers.
It uses the account principal/session, foundation `transaction` and
`lockOwnedProfile`. A caller supplies a parsed request, access mode, canonical
intent string, outcome schema and `perform` callback. There is no generic
client-controlled spend, award or balance endpoint.

The transaction locks the current principal role and session, serializes the
actor/request key, and locks the target profile. Admin access uses a distinct
target lock after current role authorization. It then checks any stored success:
the same target/kind/intent returns its original entry and outcome; different
intent conflicts. Only a new operation calls `perform`.

The callback receives the locked profile, actor, operation ID and transaction
client. All domain writes must use that client and throw on failure, with no
nested commit or external I/O. Its integer delta, reason and validated outcome
commit with the balance and History. Concurrent debits cannot overdraw the
locked balance; successful replay cannot repeat the callback's domain writes.

Migration `0003_points_history.sql` creates `app.points_operations`, unique on
`(actor_id, request_id)`, with balance arithmetic and integer constraints. Each
row stores both History and the operation outcome. Triggers reject row updates,
deletes and truncation. These constraints protect normal writes; a trusted
database owner with schema privileges is not an untrusted application user.

Future purchase/vote/award owners must define their validated intent, eligibility,
price/confirmation checks and domain outcome. Reset ordering/epochs and cumulative
award top-ups remain future integrations. Fresh checks belong inside `perform`,
after successful replay lookup and target locking. This contract implements no
journey calculation, award, purchase, vote, reset or future rounding rule.

## Verification limits

`pnpm points:test:database` runs real HTTP/PostgreSQL tests for bounds, current
authorization and revocation, cross-account denial, real/demo isolation, atomic
rollback, immutable History, key conflicts, concurrent changes and API process
restart persistence. Account and database regression commands remain documented
in [account operations](accounts.md) and [local development](local-development.md).

The isolated application ZAP baseline scans public HTTP without authenticated
admin state. A clean report is not proof of admin authorization or accounting;
the authenticated tests and local admin browser flow provide those observations.
Phone rendering, device accessibility, live provider sign-in and deployment
remain unverified by this candidate.

Written by gpt-6-astra through Codex (T3 Code).
