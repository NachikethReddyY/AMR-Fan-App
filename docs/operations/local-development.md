# Local PostgreSQL development

The infrastructure owner runs one PostgreSQL 17.11 Docker Compose service for
this host. Each worktree gets its own development/test databases and login.
The Expo phone app still calls a backend API; it never receives database access.
This setup supports implementation before Azure provisioning. It does not create
accounts, points, authentication, an API, or an admin app.

## Prerequisites and ownership

Use Node 24 and pnpm 12 from the root package, Docker with Compose, and an
operations lease for one unoccupied loopback port. Do not restart Docker to fix
an inaccessible socket while other threads use it. Confirm the execution host
and endpoint with operations. Inspect existing users before service changes.

The first infrastructure worktree owns the service until an explicit handoff.
The owner record and credentials live under `~/.auth/amr-local-postgres/` with
mode 600; directories are private. They are never copied between worktrees or
printed. Compose mounts the administrator password as a file secret. Runtime
roles have no superuser, role creation, database creation, or replication power.
Database connection access is revoked from `PUBLIC` before a database opens.

This isolates accidental/cross-role database access. Maintainer threads share
the same OS account, which can read local credentials and control Docker; this
is not protection against a hostile process running as that OS user.

## Start and provision

The owner starts the service using its operations-assigned port:

```sh
pnpm install --frozen-lockfile
pnpm db:up --port <leased-port>
pnpm db:migrate
pnpm db:seed
pnpm db:status
```

Subsequent `pnpm db:up` reuses the private owner record and persistent named
volume. It does not change the stored port or database password. The service
publishes exactly `127.0.0.1:<leased-port>:5432`, with no admin web console.
The Compose project is `amr-local-postgres`; service `postgres`; volume
`amr-local-postgres_postgres_data`. Do not use `docker compose down -v`.

After operations assigns another worktree a namespace, the service owner runs:

```sh
pnpm db:provision --worktree /absolute/path/to/consumer-worktree
```

Worktree paths use the filesystem-native canonical path, so case and symlink
aliases of one directory select one namespace. The database names are
`amr_<first-12-SHA256-of-canonical-worktree-path>_dev`
and `_test`. The worktree login can connect only to its own databases among
provisioned namespaces. Repeated provisioning reuses the existing credential.
Each consumer runs its own migration/seed/test commands from its own checkout.
Only the service owner assigns namespaces or changes shared service lifecycle.
Schema/migration filenames remain serialized through the infrastructure owner.
Do not edit an applied SQL migration. Append a numbered migration after handoff.

## Server integration and test access

`server/database/index.ts` exports `createDatabase({ NODE_ENV, DATABASE_URL })`
and `transaction(pool, async client => result)`. A transaction checks out one
connection, commits all statements together, rolls back failures, and returns
or discards the connection. Put authorization and feature policy in the owning
server operation. The helper does not grant authorization or retry an operation.

`migrate(pool)` applies sorted SQL files under `server/database/migrations/`.
An advisory transaction lock serializes migrations, and stored checksums reject
changed migration contents. The initial migration creates only the `app` schema.
`seedLocal` creates a separate `local_fixture` schema with a labelled synthetic
probe. It cannot seed in production and grants no points or identities.

Run a server command with the current worktree's private connection settings:

```sh
pnpm db:run -- node path/to/server-entry.ts
pnpm db:run-test -- node --test path/to/feature.test.ts
pnpm db:migrate --test
pnpm db:seed --test
pnpm db:test
pnpm db:reset-test
```

`db:reset-test` clears only the current worktree test database's application,
fixture and migration state, then migrates/seeds again. It preserves development
data and peer namespaces. Coordinate within a worktree before resetting while
another process uses that test database. Never print the child environment or
connection URL. Production refuses local commands and seed/reset operations.

Pool defaults are five connections, five seconds to connect, ten seconds per
statement and ten seconds idle. Remote connections verify TLS certificates;
production rejects loopback databases. Database URLs reject all query
parameters because pg can reinterpret them as host, identity, session or TLS
overrides; use the URL authority/path and explicit server configuration. Future deployment
may add a trusted CA through its server configuration, without disabling TLS.
The transaction pattern follows [node-postgres](https://node-postgres.com/features/transactions).
Database isolation uses PostgreSQL [connection privileges](https://www.postgresql.org/docs/17/sql-grant.html).
The pinned image follows the official [PostgreSQL container](https://hub.docker.com/_/postgres).

## Evidence and shutdown

Under an exclusive startup/restart lease, before other consumers attach:

```sh
pnpm db:verify
pnpm db:test
pnpm check
pnpm security:check
```

`db:verify` creates a development sentinel, exercises migrations/seeds twice,
resets only its test data, and runs rollback/concurrent-write tests. It creates
and cleans up a disposable peer role/database, proves cross-connections fail in
both directions, and proves peer data survives the owner's test reset. It then
restarts the PostgreSQL container, reads the original development sentinel,
checks exact port binding and private file permissions. It restarts a shared
service, so acquire the exclusive lease each time. It does not restart Docker.

To preserve the service and data for tomorrow, leave PostgreSQL running and
record the owner, port and consuming threads with operations. When all consumers
release it, the service owner can stop PostgreSQL without deleting the volume:

```sh
pnpm db:stop
# Later, in the same owner worktree:
pnpm db:up
```

The CI `local-postgres` job uses the same pinned service and proof on its own
isolated runner. It has no production secrets. Other repository security gates
remain enabled. An unavailable database or scanner is unverified, not a pass.

## Tomorrow's Azure setup

The Azure backend direction remains accepted; this local choice does not select
paid services or provision cloud resources. Before a cloud rollout:

1. The maintainer selects/provisions Azure PostgreSQL or another explicitly
   approved compatible persistence service, network access and trusted TLS.
2. Create separate deployment database credentials and supply server-only
   `DATABASE_URL` with `NODE_ENV=production`; never copy local superuser access.
3. Assign a migration owner, run `migrate(pool)` with deployment access, and prove
   connection, transaction, backup/restore and deployment rollback behavior there.
4. The account/API owner selects verified authentication and production roles.
   Any local identity adapter must be production-disabled and still authorize
   every server operation. This infrastructure contains no test auth bypass.
5. The API/admin owners set `API_HOST`, leased `API_PORT`, `ADMIN_ORIGIN`, and the
   phone's public `EXPO_PUBLIC_API_URL`. AI owners configure server-only
   `LUNA_BASE_URL`, `LUNA_API_KEY`, and `LAYA_BASE_URL` after verifying providers.

Live Azure credentials, identity provider, API deployment, provider inference
and cloud transaction proof remain pending until these actions occur.

Written by gpt-6-astra through Codex (T3 Code).
