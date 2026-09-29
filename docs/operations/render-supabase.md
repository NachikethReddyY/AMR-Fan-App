# Render and Supabase setup

Ops123 builds from immutable main `95e5be89060ff130c63019deb935c25ef1c93194`.
This is preparation, not a production deployment. GitHub Actions stays paused.
No cloud mutation has been performed by this candidate.

## Guarded database bootstrap

### Google budget with unverified AI accounting

The explicit `targetMigration: "0012_google_route_budget.sql"` adds the reviewed
Google schema from merged main `b78be4fee9e5be4ede5b98a20dde8402fcb728f7`.
Its SHA256 is `00aeddb091fe0c43ff753ef6d89e937d041a07cef4849c06240f54aa625dff45`.
Omitting the target still selects 0011. Existing ordinary initialization and
explicit target 0010 behavior remain unchanged.

When historical AI liability is unknown, use the protected configuration fields:

```json
{
  "targetMigration": "0012_google_route_budget.sql",
  "aiBudgetMode": "schema-install-only"
}
```

These fields supplement the existing private connection/password configuration.
`aiBudgetMode` accepts only `schema-install-only` and is mutually exclusive with
`aiBudgetInitialization`. Do not supply a zero-spend assertion. This mode requires
exact retained 0001–0010, or an already disabled 0011/0012 installation. It rejects
fresh setup, retained eight/nine, and target 0010 before mutation. Target 0011 is
also available for installing or replaying only the disabled AI schema.

Inside the existing advisory-locked transaction, the runner validates retained
history, checksums, ownership and ACLs. It executes unchanged 0011 only when
pending, immediately suspends its newly seeded fixed-scope row, and grants no
runtime rights on any of the three AI tables. Table and column access, PUBLIC or
other non-owner grants, grant options, and effective runtime authority are refused.
Pending 0012 and its ledger entry commit with the suspension, or the entire
pending chain rolls back. No session observes a committed active seed.

The unchanged SQL's numeric zero is an uninitialized placeholder. It does not
represent verified historical spend, zero outstanding liability or available
funds. Schema-only output reports
`aiBudget: "schema-installed-accounting-unverified-spending-disabled"`.
A separate reviewed liability reconciliation and activation procedure is required
before AI can become available; this runner implements neither.

Schema-only replay verifies that AI is suspended and inaccessible. It preserves
all exposure, calls, receipts and history, including nonzero or over-cap exposure.
It refuses active, initialized or partially granted AI installations instead of
revoking grants, suspending retained rows or resetting values. Ordinary replay,
including a supplied verified-zero assertion, cannot promote a schema-only
installation because its required AI privileges are absent.

Google runtime receives only SELECT on `app.google_route_budget` and
UPDATE(`used_attempts`). The runner requires the sole `singleton=true` row with
an integer counter in 0–200 and never resets it. Other runtime table privileges,
column rights, grant options, PUBLIC and client-role access are refused.
[Google's application policy](routes.md) commits a full selected-mode reservation
before dispatch, never refunds and never resets the lifetime allowance. Database
UPDATE permission alone does not enforce monotonic increments. This is an app
allowance, not an account-wide or leaked-key spending guarantee.

Keep `AMR_GOOGLE_ROUTES_KEY` absent until the schema, grants and all current API
instances are ready under root's separate activation authority. Keep
`AI_COST_DATABASE_URL` absent and AI disabled while liability remains unknown.
No new environment budget flags are introduced. Implementation and fixture proof
do not authorize production migration, provider requests or key activation.

The runner candidate was executed against isolated PG17/Node24 on main
`3beaf76f0d92d4651b0e2a85ccdd963eabafe415`: 83 deployment tests and one additional
schema-only HTTP/award case passed, with no failures or skips. This proves the
fixture behavior above, including actual AI store denial and Google exhaustion;
it does not establish historical accounting or authorize deployment.

### Photo and ordinary AI upgrade targets

The ordinary photo/AI path supports the explicit 0001–0011 chain from merged main
`e2f95534814b7e6289ba24f01aa20a919ed1514a`. Retained histories must match an exact
ordered prefix of eight, nine, ten or eleven migrations, including every checksum.
The existing advisory transaction lock covers history inspection, validation,
pending DDL, scoped grants and new ledger entries. Retained ACL drift is refused
before any pending migration; old grants are not repaired. Replay changes no data,
roles, passwords, grants or ledger rows.

Photo 0010 SHA256 is
`122ca4c3833b831febdec2eff8839e67625407cdccf4ae43e0e3a1bddbde03b1`.
Runtime receives only SELECT/INSERT on `app.photo_activity_claims`, with no
new sequence rights, UPDATE, DELETE, PUBLIC grant or grant option. Existing
participation grants remain scoped to their original columns and objects.

AI 0011 is merged with SHA256
`be6baf0dd4ccb209c266a3646a9f8494bbb2c6ca74b79f3cbef3dc0956c8013b`.
It includes the reviewed disputed-call state. The runtime grants match the
[AI owner's contract](../ai/cost-store.md):

- SELECT on `ai_cost_budget`, `ai_cost_operations` and `ai_cost_calls`.
- INSERT only on operations `(operation_id,scope,fingerprint,reservation,rate_expires_at_ms)`
  and calls `(operation_id,call_id,reserved_nano_usd,accounted_nano_usd)`.
- UPDATE only on budget `(committed_nano_usd,suspended)` and calls
  `(state,accounted_nano_usd,bound_exceeded)`.
- No budget INSERT, operations UPDATE, DELETE, TRUNCATE, new function/sequence
  rights, PUBLIC grants, ownership, owner membership or grant option.

The migration seeds the sole fixed-$10 budget row. Committed exposure can exceed
$10 while suspended after a late bound violation; the tool must preserve that
exposure and the immutable admission cap, not clamp or reset accounting.

On the ordinary path, before first applying 0011 the protected config must explicitly contain
`"aiBudgetInitialization": "verified-no-prior-spend-or-inflight"`. This is an
operator assertion, not automated proof. Supply it only after verifying the
shared scope has no prior provider spend or in-flight calls. Without it the
transaction refuses before pending DDL or role creation. Existing liabilities
require a separately reviewed import procedure; this tool implements no import
or zero-reset override. Complete eleven-migration replay needs no initialization
assertion and never resets existing accounting. No provider is enabled by migration.

The optional protected-config field `targetMigration` accepts exactly
`"0010_photo_activity.sql"`, `"0011_ai_cost_store.sql"` or
`"0012_google_route_budget.sql"`. Omission still selects
0011. For explicit 0010, fresh setup or retained eight/nine histories apply only
0001–0010; an exact ten-entry replay returns unchanged. SQL loading, grants and
validation stop at that target. No AI table, grant or budget initialization occurs,
and no zero-spend assertion is needed or consumed. An eleven-entry ledger with a
ten target is refused, never downgraded. Invalid target values fail before connecting.

Each chosen target remains atomic. The 0011 path keeps the initialization
prerequisite above; missing evidence prevents all its pending migrations. Actual
account history includes prior spend, while project-key filtering does not prove
scope ownership or the absence of pending liabilities. Do not set the assertion
for production without authoritative evidence. No inference during these tasks
establishes historical zero spend. The 0010 target can unblock independent features
while AI remains inactive. It neither establishes nor imports AI liabilities.

Run `node scripts/deploy/testing/run-isolated.mjs` under the coordinated heavy
lease. Its pinned PG17/Node24 fixture uses generated credentials, one private
internal network, no published ports and no host mounts. Historical PR51 evidence recorded forty-seven passing tests
on its main base: exact retained 8/9→10 and 8/9/10→11 upgrades, lock serialization,
late-DDL rollback, runtime permissions, preserved roles/passwords/ACLs/data and
liability replay. The actual API and journey award reader work at 0010 with all
AI tables absent; photo inference remains unavailable. New participation
REFERENCES/grant-option and MAINTAIN regressions fail against the preceding
validators and pass with the correction. Final affected static/security checks
pass. An earlier full app check passed before these runner-only corrections;
it was not repeated under the bounded verification scope. Earlier failures and
proof remain separate in local evidence.
This preparation does not authorize production migration or deployment. The
historical procedure below records the prior nine-migration release only.

### Historical reviewed participation upgrade preparation

The next release starts from merged `09b61e9213d4d08d986621439f9f16c453cc87d7`.
The deployment command now supports exactly migrations 0001–0009. A retained
installation must have the complete, checksum-matching first eight or all nine;
any other history, ownership collision or runtime privilege drift is refused.
An eight-migration installation applies only `0009_submission_participation.sql`
under `amr_migration_owner`, inside the existing advisory-locked transaction.
DDL, scoped permissions and the new ledger entry commit together or roll back.
The migration file and existing rows, timestamps, role identities and passwords
are not rewritten. A nine-migration replay verifies permissions without changes.

The runtime receives SELECT/INSERT on the four new participation tables,
UPDATE only on session closure and selection resolution columns, USAGE/SELECT
on the interaction-session identity sequence, and EXECUTE on the three trigger
functions. It receives no DELETE, TRUNCATE, schema/database CREATE, role-management
or migration-ledger privileges. Existing table grants are left intact.

After the manager supplies the reviewed final integrated commit:

1. Verify that exact commit includes this upgrade, the reviewed PR28 guest
   catalogue API and the reviewed admin-origin change. Neither a mobile branch
   tip nor mutable main is an approved deployment target by itself.
2. Read the exact project's ledger and restricted runtime privileges. Require
   unchanged 0001–0008 checksums and migration 0009 SHA256
   `dae2d00d50e1b93684082519101177984bdaa80af38951d62a1d4382379ff10e`.
3. At the authorized deployment window, run the command below with the existing
   protected bootstrap configuration and verified Supabase CA. Keep credentials
   outside the checkout and off Render. The runtime password is required by the
   input format but never altered during upgrade or replay. Do not substitute the
   ordinary development migration command; it does not enforce these role/grant
   boundaries. Re-read the ninth ledger row and effective runtime permissions.
4. Keep the existing Render service Free with auto-deploy off. Preserve every
   existing environment entry. `ADMIN_ORIGIN` remains
   `https://amr-fan-app.onrender.com`. Only after the stable Vercel production URL
   and reviewed API allowlist implementation are supplied, add
   `ADMIN_ADDITIONAL_ORIGIN=https://amr-admin.vercel.app`, the stable production
   origin reported by the admin owner. No wildcard,
   preview-pattern or Origin-header stripping is permitted.
5. Pin and deploy only the final reviewed commit. Retain
   `674273de2a94d211c8404b736adc68e6a6b9f48a` and its prior release branch for
   code rollback. An additive migration is retained on code rollback; never
   drop its tables or restore old data as part of an API rollback.
6. Verify exact deployed SHA, health, guest catalogue 200, protected unauthenticated
   denial, same-origin Render admin access and the exact Vercel-origin flow.
   Admin roles remain server-owned. Prior live proof used only a synthetic fan;
   no assigned-admin identity is established by this receipt. Keep Supabase
   autoconfirm and SMTP unchanged. CI remains paused and unverified.

No production migration or deploy is performed by this preparation. Browser UI,
Vercel origin and the final integrated candidate remain with their owners.

The separate photo candidate proposes `0010_photo_activity.sql`. Its inspected
table `app.photo_activity_claims` does not collide with 0009 and needs runtime
SELECT/INSERT only, with no new sequence or UPDATE/DELETE grant. It references
existing profiles, journeys and points operations and reuses the points-history
trigger function. The settlement hook requires this table even while photo
availability is unavailable. That candidate is not frozen: do not apply or copy
0010 yet. This command remains fixed at nine migrations; a combined photo release
needs a reviewed explicit tenth-migration extension and serialized API registration.

### Original setup receipt

Target only existing project `folakoxsilrfemctvlxj` (AMRF app, Free, Mumbai,
PostgreSQL 17). Read-only inventory found no app schema or migration ledger,
zero auth users, and zero storage buckets/objects. Recheck before provisioning.

`node scripts/deploy/supabase-database.mjs prepare --config PRIVATE_JSON`
accepts a regular file mode 0600 in a directory mode 0700 outside the checkout. Its fields
are `projectRef`, `connectionString`, and `runtimePassword`. Generate a random
48–128 character base64url runtime password in private storage, never in a shell
argument, evidence, repository or chat. The connection must name this project's
`postgres` administrator through its Mumbai IPv4 session pooler on port 5432.
TLS certificate verification stays enabled. Supply a trusted CA through the
Node trust configuration if needed, never `rejectUnauthorized:false`.

The bootstrap takes an advisory transaction lock, creates `amr_migration_owner`
NOLOGIN and `amr_api` LOGIN, applies existing migrations 0001–0009 byte unchanged,
and records checksums atomically. The administrator retains membership needed
to maintain the owner role; runtime has no memberships. Runtime cannot create
persistent schemas/tables, alter migration history, assign staff roles, or
insert/update a principal's role. It receives only the application table/function/sequence
permissions needed by the existing API. Anonymous/authenticated Supabase roles
receive no app schema access. Existing peer data and Supabase-managed schemas
are untouched. No seed, reset, password rotation or staff assignment occurs.

A complete matching installation is verified and returned unchanged. Partial
role/schema/ledger collisions, checksum drift and elevated runtime privileges
abort. Later migrations require an explicit reviewed follow-up, not silently
accepting files beyond the fixed nine. Keep bootstrap credentials off Render;
only the restricted runtime connection belongs in its server secret store.

Fresh setup and replay reject effective database CREATE, including rights inherited
from PUBLIC. Bootstrap reports the collision without revoking shared database
rights; the database owner must review the grant before retrying. Default PUBLIC
TEMP remains unchanged: runtime can create session-local temporary tables, but
not persistent schemas/tables. This is distinct from the role CREATEDB flag.

Proof uses one owned PG17 container on an internal network with no published
ports or host mounts. It includes a non-superuser CREATEROLE administrator,
real restricted login, simulated migration failure rollback, fresh schema and
role collision refusal, replay preservation, checksum refusal, role escalation
refusal, actual anon/authenticated query denial and retained synthetic peer row.
The root local DB wrapper is not used: it owns retained development namespaces.

## Identity adapter

`AUTH_PROVIDER=supabase` selects the fixed project issuer/JWKS, ES256,
`authenticated` audience, non-anonymous user identity and UUID subject/session.
It feeds the existing `/v1/session` exchange. Database application roles remain
authoritative. Generic OIDC remains the default and retains RS256/API scope
checks. Leave all `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL` and
`AUTH_REQUIRED_SCOPE` overrides empty for the fixed Supabase adapter.
`AUTH_DEV_ENABLED=false` is mandatory in production. Email/password was selected;
admin integration is locally tested. Phone integration and a human-selected
first administrator remain pending.

## Remaining activation gates

Hosted PDF processing is required. Neither macOS sandbox-exec nor the current
host-Docker child adapter works unchanged on Render. A separate owner is testing
hosted credential-free isolation. No local-publish substitute, unsafe fallback,
report disablement or PDF deletion is authorized here. API memory fit and Render
no-spend billing controls remain unverified. The separate synthetic hosted parser
experiment is accepted in principle; activation still requires its independent
policy/protocol/image gate and verified billing controls.

Implemented by gpt-6-astra through Codex (T3 Code).

## Private source storage

Set `REPORT_STORAGE_PROVIDER=supabase` only with a private
`amr-report-originals` bucket whose file limit is exactly 10485760 bytes.
`SUPABASE_STORAGE_KEY` accepts only a server-side legacy service_role JWT whose
project claim matches the fixed target. Provider verification is performed by
the authenticated bucket request; local claim parsing prevents misconfiguration,
not a substitute for provider authentication. The credential has project-wide
privilege and must never reach a browser, phone or parser process.

The adapter uses the fixed HTTPS Storage API, refuses redirects, bounds response
bytes and deadlines, serializes inventory/upload through a database transaction
advisory lock, enforces 256 MiB/1000-object capacity, writes without upsert, and
reads back the committed hash. A lost response is recoverable by same-hash retry.
Missing-object reads accept HTTP 404 or a bounded HTTP 400 JSON envelope with
semantic `statusCode` 404, `code: NoSuchKey`, and the supported `not_found` or
`NoSuchKey` error label. Other errors remain unavailable and never trigger an
upload. The error body limit is 16 KiB under the existing operation deadline.
A real HTTP regression covers first upload, retry, hash preservation and
malformed, unauthorized and oversized refusals. No live provider request is
implied. [Provider error contract](https://github.com/supabase/storage/blob/master/src/internal/errors/storage-error.ts).
Startup never deletes objects. Existing hashes, page evidence, revisions and
approvals remain in PostgreSQL. Bucket creation is pending independent review;
it is not performed by the database bootstrap command. There is no remote
storage proof yet. Local tests use synthetic responses and one loopback HTTP
redirect fixture without real credentials.

## Email/password administration

All four existing admin screens share `services/api/auth/admin.js`, served only at
`/auth/admin.js`. The public config endpoint exposes the fixed project URL and a
new `sb_publishable_` key only when Supabase auth is selected; secret/legacy keys
refuse startup. The helper submits passwords directly to the fixed Supabase
HTTPS endpoint, discards provider refresh credentials and exchanges the signed
access token for the existing opaque application session. Passwords are cleared
from the form on submit. Nothing is stored in localStorage/sessionStorage.
The application API never receives the password. Existing server role checks,
fixture restrictions, dashboard actions and request IDs stay unchanged.

The exact Supabase origin is added to connect-src only when live sign-in config
is present. No OAuth, sign-up, password reset, seeded user or first-admin
assignment is included. A human-selected existing identity is needed later.
The browser may offer its own password manager; the app implements no persistence.

## Prepared Render service

`render.yaml` describes one Free Node web service in Singapore, at repository
root, Node 24.20.0 and pnpm 12.6.0. It uses the frozen lock without install scripts,
`API_HOST=0.0.0.0 API_PORT="$PORT" pnpm api:start`, and `/health`. The existing
API Dockerfile remains an isolated scanner fixture, never the deployment image.
Health is liveness after initial database startup validation, not complete report
readiness. Auto-deploy is off; activate only an independently verified exact
commit. The blueprint's main branch is a source selection, not permission to
create/deploy now. Missing parser configuration is a blocker, not a shipped
placeholder feature. A separately hosted parser may require a reviewed manifest
change after its owner proves the execution boundary.

Render CLI 2.28.0 is authenticated; workspace `tea-darket17lnhs73dois9g` is selected,
with zero projects/services at read-only inventory. GitHub admin access to the
private repository is verified. After the user connected GitHub in Render, the
one authorized repeat Blueprint validation returned `valid: true`, proposing
`amr-api-demo` with one action. This proves source resolution, not deployment.
Render billing/payment method and overage controls are also unverified: do not
create compute until the no-spend requirement is established. Free web compute
is 512 MiB/0.1 CPU; 750 monthly hours are shared across services. Sleeping after 15 idle
minutes is not a spending control. No keep-awake polling is proposed. Supabase
Free has 500 MB database/1 GB object storage; no upgrade/add-on is authorized.

API idle/peak RSS is unmeasured. No claim of capacity, hosted parser readiness,
complete admin accessibility or live human login is made by local fixture tests.
CLI/API metadata reads are not cloud deployment proof. GitHub Actions stays off.

Primary references: [Render Free](https://render.com/docs/free),
[Render blueprint](https://render.com/docs/blueprint-spec),
[Supabase sessions](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## Dashboard gates before any Render creation

Select Nachiketh's workspace `tea-darket17lnhs73dois9g` in the Render Dashboard.
Open **Billing** and record the actual workspace plan, payment-method presence,
current Free instance hours, outbound bandwidth and pipeline usage. Open
**Workspace Settings > Build Pipeline** and record the tier and spend limit.
Do not change billing during this read-only step. A Free service plan alone does
not prove zero spend: supplementary bandwidth and pipeline usage can be billed
when a payment method exists. A pipeline cap does not cap bandwidth charges.
The minimum unambiguous no-spend state is Hobby plus no payment method, with
Free compute only and remaining included usage. If a card is already present,
hold creation until enforceable zero-overage controls are independently verified;
do not remove the card or change shared billing without explicit scope.

In **Account Settings > Account Security > Git Deployment Credentials**, inspect the connected
GitHub account. Use GitHub's installed Render app configuration to confirm access
to the private `NachikethReddyY/AMR-Fan-App` repository. If access is absent, the
human must grant that exact repository, then rerun Blueprint validation. Keep
repository visibility private. The first validation could not resolve `main`; the single retry after the user
confirmed connection returned `valid: true`. Preserve that private connection.
Do not work around future access failures by publishing source or using an
unknown registry.

For the separately accepted synthetic parser experiment, require an explicit
independent PASS covering the actual protocol/image and isolation assertions.
A successful process exit alone is insufficient. A local parser PASS does not
clear these billing/source gates or prove Render kernel behavior. Keep the main
API inactive and auto-deploy off. Prefer a reviewed Dockerfile built from the
private Git repository; a private prebuilt `linux/amd64` image needs an approved
private registry, immutable digest and read-only pull credential first. No image
publication or service creation is part of this candidate.

Validation limit: stock `pnpm check` reaches an existing unformatted ignored
Supabase CLI cache (`supabase/.temp/linked-project.json`). The cache and local link
are preserved; the candidate's tracked/non-ignored source set is checked with
Prettier separately, followed by every remaining check stage.

Browser proof used the actual four admin asset sets at 1280×800 with a loopback
HTTP fixture and an intercepted synthetic provider response. Each page passed
failed-login, non-admin denial, admin workspace and logout cases; password fields
cleared, local/session storage stayed empty and no runtime errors appeared.
This proves client behavior with synthetic responses. Real PostgreSQL API tests
separately prove server-owned roles, identity replay and production auth guards.
Live Supabase authentication/storage and full accessibility auditing remain
unverified. All owned browser/services/api/database fixtures were closed and removed;
the retained shared PostgreSQL service and Supabase local link were untouched.
