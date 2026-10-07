# Azure API staging handoff

This directory is a reviewable deployment package only. It does not create
Azure resources, call Luna, enable OneMap, build an image, or publish a
revision. The package describes one externally reachable Azure Container Apps
API replica, one private PostgreSQL Flexible Server, Key Vault indirection for
the API database URL, a user-assigned managed identity, and redacted
workspace-backed platform logs, with Application Insights provisioned for
future SDK instrumentation. The current API does not include an Application
Insights SDK, so no request telemetry or traces are claimed. Blob Storage,
queues, AKS and a microservice split are intentionally absent.

`server/api/Dockerfile.production` is separate from the existing DAST-only
`server/api/Dockerfile`. The production image starts `server/api/start.ts` as a
non-root `node` user, listens on port 8080, keeps route providers disabled, and
contains no provider credentials. The image reference passed to `main.bicep`
must be immutable (use a registry digest). Docker is unavailable in this local
workspace, so no Linux build or image-size claim is made.

## Readiness and TLS

`GET /health` is a process liveness check and does not query PostgreSQL.
`GET /ready` performs a one-second bounded `SELECT 1 FROM app.principals`
dependency check and returns HTTP 200 only when the database is reachable; a
failure returns HTTP 503 with a fixed dependency state and no error details.
The API startup path also performs a database query before opening its listener.
The Bicep probes use `/health` for liveness and `/ready` for readiness.

`server/database/config.ts` rejects local PostgreSQL URLs in production, rejects
URL query overrides, and enables `rejectUnauthorized: true` for non-loopback
hosts. The Flexible Server is private-networked and `require_secure_transport`
is set to `on`. The Key Vault `database-url` value must point at a dedicated
least-privilege API login; the PostgreSQL administrator password is only for
the migration/bootstrap identity.

## Controlled migration handoff

Migrations are a separate release step and are not run by the API container.
Inject the migration identity URL from the release secret store without writing
it to the repository or shell history, then run:

```powershell
$env:NODE_ENV = 'production'
$env:AMR_MIGRATION_APPROVED = 'true'
$env:DATABASE_URL = '<secret-store-injected-migration-url>'
node deploy/azure/migrate.mjs
Remove-Item Env:DATABASE_URL,Env:AMR_MIGRATION_APPROVED,Env:NODE_ENV
```

The command refuses non-production mode, missing `DATABASE_URL`, or an absent
explicit approval flag. It applies the ordered checked-in migration set under
the existing advisory lock and checksum ledger, prints only the migration
count, and returns a generic failure without database details. Take/verify the
PostgreSQL backup before approving a migration. Schema changes are forward
only; rollback uses the prior immutable image and a reviewed database restore
procedure when needed.

## Review commands

Run these read-only checks from the repository root after installing the locked
dependencies:

```powershell
node --check deploy/azure/migrate.mjs
node --check server/api/start.ts
git check-attr -a -- server/awards/factors/cag-surface-access-co2-v1.md server/database/migrations/0014_activity_assessments.sql
git show HEAD:server/awards/factors/cag-surface-access-co2-v1.md | git hash-object --stdin
docker build --file server/api/Dockerfile.production --tag amr-api:review .
```

The expected factor evidence hash remains
`399d5f48e278d6f185eb789d882d6157126c28a36349ffa650957e82864ac6fa`.
The final command is intentionally unavailable here because Docker is not
installed; do not report an image or Linux proof until it runs in a Linux-capable
environment. Azure CLI is not available on the current command path, so Bicep
compilation and `what-if` are unverified in this review. No Azure reads or
writes were performed for this package.

Before any authorized deployment, supply reviewed values for the container
image digest, OIDC issuer/audience/JWKS/scope, migration URL, API URL secret,
backup/restore owner, and log retention. Keep `minReplicas=maxReplicas=1` until
shared admission/rate-limit behavior has a distributed proof. Keep Luna and
OneMap disabled until their separately approved secrets and provider checks
exist.

## Activation gates from the local review

This package is reviewed but is not cleared for deployment. The release owner
must record evidence for each gate before exposing a revision:

- Restrict Key Vault and Application Insights network access and prove the
  intended Container Apps identity can reach the required endpoints. The draft
  currently permits public network access; RBAC still applies.
- Provision and verify a dedicated API database role that cannot create schema
  or run migrations. Do not use the migration administrator as the API login.
- Complete all checked-in migrations before routing traffic. `/ready` currently
  proves database reachability only, not the latest migration or schema version.
- Verify that the supplied image reference contains a registry digest. The Bicep
  parameter currently accepts mutable tags, so this is a release validation gate.
- Build/start the Linux image, compile Bicep, exercise readiness and rollback,
  and prove backup restoration in the approved staging environment.

The overnight task creates no Azure resources and enables no paid providers.
