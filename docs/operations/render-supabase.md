# Render and Supabase setup

Ops123 builds from immutable main `95e5be89060ff130c63019deb935c25ef1c93194`.
This is preparation, not a production deployment. GitHub Actions stays paused.
No cloud mutation has been performed by this candidate.

## Guarded database bootstrap

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
NOLOGIN and `amr_api` LOGIN, applies existing migrations 0001–0008 byte unchanged,
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
accepting files beyond the fixed eight. Keep bootstrap credentials off Render;
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
Startup never deletes objects. Existing hashes, page evidence, revisions and
approvals remain in PostgreSQL. Bucket creation is pending independent review;
it is not performed by the database bootstrap command. There is no remote
storage proof yet. Local tests use synthetic responses and one loopback HTTP
redirect fixture without real credentials.

## Email/password administration

All four existing admin screens share `server/auth/admin.js`, served only at
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
unverified. All owned browser/server/database fixtures were closed and removed;
the retained shared PostgreSQL service and Supabase local link were untouched.
