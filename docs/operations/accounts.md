# Account API foundation

Issue [#4](https://github.com/NachikethReddyY/AMR-Fan-App/issues/4) supplies the
account foundation. The email identity provider and deployment values remain
unselected. The production adapter accepts RS256 OIDC access tokens for this API,
with exact issuer, audience and required scope plus signature, subject, issued-at,
not-before and expiry verification. Email and client role claims never identify
or authorize an account. The prepared native code/PKCE flow is held on the separate account UI branch,
pending required iOS accessibility proof. This server candidate changes no phone UI.

## Local run

Obtain an operations API port lease and an infrastructure-provisioned
worktree namespace first. Use the existing local PostgreSQL service; do not start
or restart another owner's service. Then:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:migrate --test
pnpm account:test
pnpm account:test:database
AUTH_DEV_ENABLED=true API_HOST=127.0.0.1 API_PORT=<leased-api-port> pnpm db:run -- pnpm api:start
```

The held phone UI uses `10.0.2.2` instead of `127.0.0.1` for Android emulator API requests. These
public values are endpoints and feature selectors, never credentials. The
server fixture selector accepts `fan-a` or `fan-b`, mapped to fixed synthetic
subjects. It never accepts an arbitrary issuer, subject, email, owner or role.
The resulting sessions pass the same ownership/admin authorization as OIDC users.
Local identities remain clearly labelled test accounts, separate from demo
profiles. Each test identity still owns a real and a demo profile.

Synthetic mode requires explicit development/test configuration and loopback
binding. Production rejects it at startup. Without an accepted issuer setup,
email sign-in reports that provider setup is pending. Never use synthetic mode
as evidence of live email authentication. Expo Go can prove local account flows;
provider redirects require a native development/release build and registered
redirect URI.

## HTTP contract and accounting handoff

All replies are JSON with `no-store`; writes accept bounded JSON bodies. Native
clients send `Authorization: Bearer <credential>`. Browser origins are rejected
until the separate admin web integration configures an explicit origin policy.
No cookie session or public role-assignment endpoint exists.

| Endpoint | Credential | Result |
| --- | --- | --- |
| `POST /v1/session` | Verified provider access token | New opaque session and existing/new account |
| `POST /v1/dev/session` | Local fixture selector only | Development-only synthetic session |
| `GET /v1/me` | Opaque session | Current principal role and owned real/demo profiles |
| `GET /v1/profiles/:id` | Opaque session | Owned profile, otherwise 404 |
| `PATCH /v1/profiles/:id` | Opaque session | Update only `displayName`, otherwise refuse |
| `DELETE /v1/session` | Opaque session | Revoke this session |
| `GET /v1/admin/session` | Opaque session | 200 only for a server-assigned current admin |

The server validates configuration at startup, caps bodies at 4 KiB and bounds
authenticated requests to 300 per minute per process. This is a small local API
limit, not a distributed deployment quota. Provider keys are fetched only from
the configured HTTPS JWKS endpoint with a deadline and cached key rotation.

Migration `0002_accounts.sql` owns `app.principals`, `app.profiles`,
`app.sessions` and `app.role_assignments`. The identity key is `(issuer, subject)`;
profiles are unique on `(principal_id, kind)`. Both kinds start at zero. Repeated
sign-in only creates missing profiles and does not reset names or balances.
Only SHA-256 hashes of random 256-bit session tokens are stored on the server.
Sessions expire after seven days. The held native branch uses SecureStore. Its logout writes
a pending-revocation marker before network I/O. A restart retries revocation
instead of reopening that account. Network failures hide account data and offer
retry; invalid/expired sessions return to sign-in. Switching demo/real stores a
local preference without changing ownership.

Issue #5 uses `transaction(pool, client => ...)` from `server/database/index.ts`
and `lockOwnedProfile(client, verifiedPrincipalId, profileId)` from
`server/accounts/store.ts`. The latter enforces ownership and takes `FOR UPDATE`.
The accounting module must keep balance, History, idempotency and outcomes in
that same transaction. This slice has no award, spend, reset or ledger API.
A role is read from PostgreSQL on every request; a client badge grants nothing.
An admin role alone does not bypass personal profile reads or writes.

## Authorized role assignment

A maintainer with server/database setup access can assign an already-created
principal, with a reason, using:

```sh
pnpm db:run -- node server/accounts/assign-role.ts <principal-uuid> admin "<authorized reason>"
```

Use `fan` to revoke that role. The assignment and reason are recorded atomically.
No administrator identity is invented or seeded. The command runs only in a
trusted operator environment; deployment operator access and audit retention
must be selected before real accounts use it.

## Live setup still required

- Select/provision the Azure-compatible email sign-in provider and register a
  native public client with authorization-code/PKCE and an API access scope.
- Set server-only `AUTH_ISSUER`, `AUTH_AUDIENCE`, `AUTH_JWKS_URL`,
  `AUTH_REQUIRED_SCOPE`, `DATABASE_URL`, `NODE_ENV=production`, API host/port,
  and `AUTH_DEV_ENABLED=false`. Use a dedicated API audience, not a Graph token
  or an ID token audience. Test the chosen tenant's actual claim/key behavior.
- Set public native `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_ISSUER`,
  `EXPO_PUBLIC_AUTH_CLIENT_ID`, `EXPO_PUBLIC_AUTH_API_SCOPE`, and
  `EXPO_PUBLIC_AUTH_REDIRECT_URI`; keep local sign-in disabled. `amrfan` is the
  held UI branch's app scheme, not an externally registered redirect destination.
- Provision Azure PostgreSQL/network/TLS and run the migrations with a designated
  migration identity. No paid resource or production deployment is created here.
- Verify real email sign-in, cancellation, sign-out, expiry and another-device
  resume against the selected provider. Assign the authorized admin through the
  operator path and verify revocation. Define retention/deletion before real data.

Primary implementation references: [Expo authentication](https://docs.expo.dev/guides/authentication/),
[Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/),
[jose verification](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md),
[Microsoft access-token claim validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation).

Written by gpt-6-astra through Codex (T3 Code).
