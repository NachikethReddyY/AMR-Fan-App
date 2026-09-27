# Shared AI cost storage

`server/ai/postgres-cost-store.ts` implements the PR45 `AiCostStore` contract.
It is an inactive server adapter. It does not dispatch providers or establish
gateway prices, token bounds, account funds, or permission to spend.

## Admission and recovery

Migration `0011_ai_cost_store.sql` adds three tables. Forward migration
`0013_ai_new_amr_scope.sql` permits the legacy scope plus the fixed future scope
`amr-new-calls-20260927-v1` and sets legacy `suspended = true`. It preserves all
legacy amounts, operation snapshots, calls and holds. It does not insert the new
row. Every new-store transaction locks only the new scope's `app.ai_cost_budget`
row and validates its identity, fixed cap and nonnegative committed amount.
An absent or invalid row denies the operation; the store never falls back to legacy.
The admission ceiling is fixed at 10,000,000,000 nano-USD ($10), shared by all
callers of this database. Reservation input is validated and amounts are
recomputed with integer arithmetic. Immutable operation snapshots bind the
fingerprint, rates, expiry and one or two calls. Exact replay returns `duplicate`;
changed input fails closed. Neither result grants another dispatch.

`claimCall` commits `reserved` to `started` once, with a database wall-clock
expiry check after the lock wait. The owner must claim immediately before
dispatch, outside the transaction, and must never dispatch on false or failure.
A crash after claim can lose availability but cannot grant a replay. There is
no time-based release. `cancelCall` releases only a stage still reserved; racing
claim and cancellation serialize on the same lock. Cancellation is irreversible.

`reconcile` accepts only server-computed `accountAiUsage` accounting. The model
and client must never supply amounts. Reported charges within the reservation
release only the unused difference; exact repeats do nothing. A conflicting
receipt marks the call `disputed`, preserves its original reported amount,
restores its entire reservation to the budget and suspends admission in one
transaction. Only after that commit does reconciliation return a conflict.
All subsequent accounting for that disputed call returns conflict without
changing its receipt or hold, including the original amount or unknown usage.
Unknown usage keeps the full stage hold. A later trusted receipt
can resolve an unknown hold. A delayed unknown result cannot overwrite a receipt.
Timeout, cancellation, HTTP failure and product rejection do not prove no bill.

A bound violation restores the full hold and persistently suspends reservations
and claims, even if it arrives after a receipt. Exposure can consequently exceed
$10; the admission ceiling remains $10. The store cannot prevent a provider from
breaking its promised billing bound. It never hides this exposure by clamping it.
Neither receipts nor process restarts clear suspension, a disputed hold or a
bound-violation hold. For a disputed call, `accounted_nano_usd` retains the original
receipt while its full `reserved_nano_usd` contributes to the budget exposure.
There is deliberately no reset/resume API. Recovery requires a separately
reviewed operator procedure that verifies actual billing, provider bounds and
all in-flight calls before adjusting the database. Do not clear rows to recover.

## Runtime inputs and authority

`aiCostDatabaseConfig(env)` returns a PostgreSQL pool configuration only when
`AI_COST_DATABASE_URL` is explicitly supplied. It never falls back to the app's
`DATABASE_URL`, so a developer worktree does not silently acquire its own $10.
Optional `AI_COST_SCOPE` is an assertion only: if present it must exactly equal
`amr-new-calls-20260927-v1`, including when the database URL is absent. It cannot
select another budget. Remote connections verify TLS; production loopback and URL option overrides
are rejected. The caller owns the pool and its shutdown. Construct the store
with `createPostgresAiCostStore(pool)`; this does not migrate or seed anything.
No route or enabled provider is wired by this slice.

Every development and hosted caller must use the same approved database and
budget row. Configuration validation cannot establish that two different URLs
reach the same database. Before activation the deployment owner must verify that
fact, provision the migration and runtime grants, preserve existing spend and
unknown holds, and supply separately verified rates, billing ceilings and
gateway/account safeguards described in [integration](integration.md).
The new allowance covers only future AMR calls through TokenRouter on a dedicated
key. The user's prior account $23.37 is excluded, not declared zero. Migration
0011's historical legacy row is not evidence of reconciled liability and is never
renamed, reset or reused as the new allowance.
Missing configuration or database failure must deny dispatch. Store errors are
generic and contain no connection details or input payloads.

## Future initialization, still held

This source change does not authorize creating a key, executing a production
initializer or activating providers. Before a separately reviewed operator action:

1. Establish the fresh dedicated TokenRouter key's identity, creation and sole
   custody. Prove it has never dispatched, with no in-flight or outstanding calls.
   A displayed zero usage counter alone cannot establish this.
2. Verify that the fixed new scope has no existing row, operations or outstanding
   liability in the approved database. Source-ref absence is not database proof.
3. Verify all development and hosted callers bind to that one database and scope.
   Do not grant another allowance to a worktree, deployment or replacement key.
4. With dispatch still disabled, use one plain `INSERT` for the fixed scope with
   `cap_nano_usd = 10000000000` and `committed_nano_usd = 0`. An existing row or
   conflicting operation is a failure, never an upsert, reset or fallback.
   Record reviewed proof before enabling admission; separately satisfy the
   provider/model/image/rate/all-in charge bounds and root's activation decision.

Key rotation retains this same budget and accumulated exposure. Missing proof
leaves the row absent and dispatch denied. Isolated test fixtures initialize a
synthetic row explicitly; those fixtures make no claim about any real key or DB.
Legacy recovery remains a separately reviewed operator procedure; the new store
rejects legacy identities and cannot settle, cancel or replay their holds. The
existing global operation-ID uniqueness also rejects a collision with a legacy
snapshot instead of turning it into a new-scope duplicate grant.

## Runtime grants

The runtime role needs `USAGE` on schema `app` and these grants only:

| Table | Select | Insert columns | Update columns |
| --- | --- | --- | --- |
| `ai_cost_budget` | All columns | None | `committed_nano_usd`, `suspended` |
| `ai_cost_operations` | All columns | `operation_id`, `scope`, `fingerprint`, `reservation`, `rate_expires_at_ms` | None |
| `ai_cost_calls` | All columns | `operation_id`, `call_id`, `reserved_nano_usd`, `accounted_nano_usd` | `state`, `accounted_nano_usd`, `bound_exceeded` |

No sequence or function grants are needed. The migration owner owns tables;
runtime must not own them or inherit the owner. Deny `DELETE`, `TRUNCATE`, DDL,
grant options, budget insertion and writes to the scope, cap or quote snapshot.
`PUBLIC` receives no table privileges. The trusted server role can update the
counter and state; this is not a defense against a compromised server credential.
There is no client-facing cost endpoint or account/points coupling.

## Isolated verification

Run `node server/ai/testing/run-isolated.mjs` only with the coordinated heavy
test slot. It builds from the repository's pinned Node 24 and PostgreSQL 17
images, starts one disposable container on its own internal network, and uses
generated credentials. It publishes no host ports, mounts no host files, and
cleans its owned container/network/image after success or test failure. Build
dependencies may use network access; the running database cannot reach providers.
The test guard requires its exact test database and loopback connection.

The fixture applies the available migration chain and explicitly inserts its
new-scope test row. All nineteen PostgreSQL cases passed on the complete
0001 through 0013 chain at main `c528ff54` plus this allowance change.
The new cases cover forward legacy preservation for every call state, no automatic
row creation, missing-row denial, scope rejection and legacy operation collisions.
Focused pure tests pass for the fixed quote/schema/config identity, pre-connection
wrong-scope denial and database failure. Four scope/config expectations failed
before implementation. These tests establish local behavior only.
Tests exercise independent processes,
concurrent cap admission, reconnect/replay,
claim/cancel rules, partial two-stage settlement, unknown recovery, lock-wait
expiry, persistent suspension, disputed receipts, rollback and the exact runtime grants above.
No real provider, hosted database, fan data or paid request is used.

Implemented by gpt-6-astra through Codex (T3 Code).
