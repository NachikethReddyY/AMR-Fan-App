# Shared AI cost storage

`server/ai/postgres-cost-store.ts` implements the PR45 `AiCostStore` contract.
It is an inactive server adapter. It does not dispatch providers or establish
gateway prices, token bounds, account funds, or permission to spend.

## Admission and recovery

Migration `0011_ai_cost_store.sql` adds three tables. Every transaction first
locks the single `app.ai_cost_budget` row for `amr-tokenrouter-dev-and-demo`.
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
release only the unused difference; exact repeats do nothing and conflicting
receipts fail. Unknown usage keeps the full stage hold. A later trusted receipt
can resolve an unknown hold. A delayed unknown result cannot overwrite a receipt.
Timeout, cancellation, HTTP failure and product rejection do not prove no bill.

A bound violation restores the full hold and persistently suspends reservations
and claims, even if it arrives after a receipt. Exposure can consequently exceed
$10; the admission ceiling remains $10. The store cannot prevent a provider from
breaking its promised billing bound. It never hides this exposure by clamping it.
Neither receipts nor process restarts clear suspension or a bound-violation hold.
There is deliberately no reset/resume API. Recovery requires a separately
reviewed operator procedure that verifies actual billing, provider bounds and
all in-flight calls before adjusting the database. Do not clear rows to recover.

## Runtime inputs and authority

`aiCostDatabaseConfig(env)` returns a PostgreSQL pool configuration only when
`AI_COST_DATABASE_URL` is explicitly supplied. It never falls back to the app's
`DATABASE_URL`, so a developer worktree does not silently acquire its own $10.
Remote connections verify TLS; production loopback and URL option overrides
are rejected. The caller owns the pool and its shutdown. Construct the store
with `createPostgresAiCostStore(pool)`; this does not migrate or seed anything.
No route or enabled provider is wired by this slice.

Every development and hosted caller must use the same approved database and
budget row. Configuration validation cannot establish that two different URLs
reach the same database. Before activation the deployment owner must verify that
fact, provision the migration and runtime grants, preserve existing spend and
unknown holds, and supply separately verified rates, billing ceilings and
gateway/account safeguards described in [integration](integration.md).
Missing configuration or database failure must deny dispatch. Store errors are
generic and contain no connection details or input payloads.

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

The fixture applies the available migration chain, including independent `0011`.
If `0010` has not landed, this proves `0001` through `0009` plus `0011`, not the
future integrated photo chain. Re-run after the photo migration lands. Tests
exercise independent processes, concurrent cap admission, reconnect/replay,
claim/cancel rules, partial two-stage settlement, unknown recovery, lock-wait
expiry, persistent suspension, rollback and the exact runtime grants above.
No real provider, hosted database, fan data or paid request is used.

Implemented by gpt-6-astra through Codex (T3 Code).
