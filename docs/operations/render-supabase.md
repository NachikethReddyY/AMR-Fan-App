# Render and Supabase setup

Ops123 builds from immutable main `95e5be89060ff130c63019deb935c25ef1c93194`.
This is preparation, not a production deployment. GitHub Actions stays paused.
No cloud mutation has been performed by this candidate.

## Guarded database bootstrap

Target only existing project `folakoxsilrfemctvlxj` (AMRF app, Free, Mumbai,
PostgreSQL17). Read-only inventory found no app schema or migration ledger,
zero auth users, and zero storage buckets/objects. Recheck before provisioning.

`node scripts/deploy/supabase-database.mjs prepare --config PRIVATE_JSON`
accepts a regular file0600 in a directory0700 outside the checkout. Its fields
are `projectRef`, `connectionString`, and `runtimePassword`. Generate a random
48–128 character base64url runtime password in private storage, never in a shell
argument, evidence, repository or chat. The connection must name this project's
`postgres` administrator through its Mumbai IPv4 session pooler on port5432.
TLS certificate verification stays enabled. Supply a trusted CA through the
Node trust configuration if needed, never `rejectUnauthorized:false`.

The bootstrap takes an advisory transaction lock, creates `amr_migration_owner`
NOLOGIN and `amr_api` LOGIN, applies existing migrations0001–0008 byte unchanged,
and records checksums atomically. The administrator retains membership needed
to maintain the owner role; runtime has no memberships. Runtime cannot create
objects, alter migration history, assign staff roles, or insert/update a
principal's role. It receives only the application table/function/sequence
permissions needed by the existing API. Anonymous/authenticated Supabase roles
receive no app schema access. Existing peer data and Supabase-managed schemas
are untouched. No seed, reset, password rotation or staff assignment occurs.

A complete matching installation is verified and returned unchanged. Partial
role/schema/ledger collisions, checksum drift and elevated runtime privileges
abort. Later migrations require an explicit reviewed follow-up, not silently
accepting files beyond the fixed eight. Keep bootstrap credentials off Render;
only the restricted runtime connection belongs in its server secret store.

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
admin/phone integration and a human-selected first administrator remain pending.

## Remaining activation gates

Hosted PDF processing is required. Neither macOS sandbox-exec nor the current
host-Docker child adapter works unchanged on Render. A separate owner is testing
hosted credential-free isolation. No local-publish substitute, unsafe fallback,
report disablement or PDF deletion is authorized here. API memory fit, Render
private repository access and no-spend billing controls remain unverified.

Implemented by gpt-6-astra through Codex (T3 Code).
