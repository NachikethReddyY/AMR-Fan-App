# Photo activity server integration

This branch contains only the server slice, rebased onto the PR 28 squash
`1dd01419ef689cf6e316ef27005f3c4fbf765e5d`. The camera client is on main; PR 28
owns its native proof. The AI assessment module is already on main from PR 45
and has no difference here. No App, auth, dock, client tests or native dependency changes are
part of this PR. Original client evidence remains associated with `ca71166`.

## Registered, disabled API

`services/api/api/app.ts` constructs `createPhotoHandler(pool)` once and dispatches it
after the existing global rate/origin checks and bearer extraction. The handler
validates the profile UUID, authenticates the server session and checks ownership.
Demo profiles are rejected. It exposes:

- `GET /v1/profiles/:id/activity/availability`: 200 with
  `{kind:'unavailable', creditedPoints:0}`.
- `POST /v1/profiles/:id/activity/photos`: 503 with the same body, before reading,
  parsing, storing or decoding the request body. Clients must not upload media.
- Other methods at these paths: 405. Anonymous access: 401; another owner's
  profile: 404; demo profile: 409; unapproved browser origin: 403.

The existing API limits remain 300 requests/minute globally, a 10-second request
and headers timeout, and a 5-second keep-alive timeout. No photo activation env
flag, provider, model invocation or production award writer exists. The route
never imports the offline image decoder or test accounting writer. In particular,
a client-supplied photo, points amount or verdict cannot trigger assessment.

## Offline decoder

`services/api/activity/media.ts` uses exact sharp 0.35.4 (Node >=20.9, compatible with
Node24). It accepts JPEG/PNG signatures, at most 2 MB input, one frame and 16 MP,
with one decode at a time per process and no Sharp cache. It hashes normalized
pixels before bounded JPEG output, strips metadata, and clears owned byte buffers
on success/failure. JavaScript or native-library copies are not secure heap
zeroization. There is no photo persistence or external upload.

Each Sharp pipeline has a 5-second timeout. This is not a hard 5-second whole
operation deadline; HTTP abort does not terminate Sharp. The disabled HTTP route
does not invoke either pipeline. Changed photos, cropping and recompression can
produce distinct hashes for the same action. This is reused-image detection,
not semantic duplicate or fraud proof.

One original macOS/Node24 sample used a 16 MP solid-color PNG (221,655 bytes),
produced a 15,269-byte JPEG in 163.67 ms including fixture generation, and peaked
at 196.55 MiB process RSS. Sample size is one. Whole-API Linux/Render 512 MB fit
remains unverified; this local measurement does not authorize activation.

## Migration and deployment ordering

`0010_photo_activity.sql` creates only `app.photo_activity_claims`: server receipt
ID, account-owned profile, globally unique pixel hash, optional unique journey,
unique deferred ledger operation, supported activity/confidence, fixed 50 credit
and provenance. No original photo, description, endpoint text or observations are
retained. Receipts are immutable. The optional journey link is server-owned;
receipt IDs and endpoint text do not establish real-world action identity.

The generic local migration runner discovers 0010 automatically. Hosted upgrade
support is separately owned by infrastructure and must verify retained migrations,
checksums, ownership, scoped grants, rollback and replay. This PR does not edit
`scripts/deploy/supabase-database.mjs` or execute any shared/hosted migration.

The infrastructure-owned upgrader must apply this table-specific grant contract
as the existing migration owner, after creating 0010:

```sql
REVOKE ALL ON TABLE app.photo_activity_claims FROM PUBLIC, amr_api;
GRANT SELECT, INSERT ON TABLE app.photo_activity_claims TO amr_api;
```

Also revoke all table access from `anon` and `authenticated` when those roles
exist. The role-existence handling belongs to the hosted upgrader. No new sequence
or UPDATE/DELETE grant is needed. Preserve schema USAGE and existing principal/profile/journey/ledger permissions; do not grant
migration authority to the API role. Hosted upgrade must deny PUBLIC, anon and
authenticated access under the existing deployment privilege contract.

**Deployment hold:** migration 0010 and its reviewed grants must be applied before
running this version of the existing award reader or settlement endpoint. Those
hooks query the new table even though production photo credit is disabled. Code
merge is not activation or deployment. With automatic deployment disabled and
this order enforced, the missing upgrader blocks deployment, not review or merge
of the code. The manager owns any later merge/deploy turn.

## Accounting

Photo claims and journey settlement share `runPointsOperation`: current session
and owned-profile lock, then journey lock, then domain receipt and points/History
writes in one transaction. Global pixel-hash serialization and unique constraints
prevent reused-image and duplicate linked-journey payment across concurrent claims.
Same-key replay returns the receipt; different intent with the same key fails.
A previously paid journey rejects a late photo.

A supported verdict with confidence strictly above 0.5 selects exactly 50 points
in code. No daily cap exists. Settlement pays only
`max(0,target-max(existingCumulative,preliminary))`; a target below 50 never claws
back. Both settlement and the read endpoint include the same preliminary award.
The existing no-photo journey behavior is retained.

`claimSyntheticPhoto` is test-only (NODE_ENV=test, fixture provenance for linked
journeys). HTTP cannot call it. Synthetic balances prove database transactions,
not assessed fan activities. Production credit remains unavailable. Same-action
identity for changed photos, and matching an unlinked photo to a future verified
journey, remain explicit activation gates.

## Verification scope

`pnpm activity:test` runs five policy/media tests. The separate disposable
database runs contain nine activity tests and thirteen award tests, all without
skips. These counts are test declarations, not assertion or scenario counts.
Disposable PostgreSQL tests in
`services/api/activity/database.test.ts` cover replay, early/late ordering, concurrency,
zero-clawback, ownership/revocation/demo denial, rollback, no daily cap, and the
registered production API's unavailable/no-credit, origin and rate behavior.
The database suite refuses any database name except `amr_photo_disposable`.
Existing award database regressions use a second database inside the same owned
container. No shared database is used.

The full check and frozen install pass on the PR28 base. Source/dependency
security checks pass with no source findings and one existing moderate advisory.
The standard ZAP 2.17.0 passive crawl on the pre-PR28 server tree reported three
informational admin-page alerts: 10024 (scanner-generated email/password query
parameters), 10109 (modern web app) and 10111 (authentication detected). No blocking
alert occurred. It did not prove protected activity coverage.

A separate passive scan of the real registered API, repeated after the PR28
rebase, used a disposable synthetic session and recorded availability 401/200,
photo POST 503, wrong method 405, demo 409 and origin 403. Both activity paths are
in the ZAP URL inventory; this scan reported zero alerts and exit 0. Its first
local hook attempt failed due to a ZAP Python API mismatch; the corrected reruns
passed. No active/browser scan or external provider ran. The pinned scanner is
`ghcr.io/zaproxy/zaproxy@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef`.
Passive scanning does not prove authorization or accounting; the real DB tests
provide those behavioral checks. All owned containers, networks and image tags
were removed. Shared services were untouched.

Raw evidence remains ignored under `.evidence/photo-activity/`. Native camera
return, permission behavior and accessibility are PR 28's proof, not a claim of
this backend PR. Live TokenRouter protocol, Luna image/retention, pricing/token
bounds and the shared $10 hard admission cap remain unresolved. No inference,
cloud mutation or spend is authorized by this change.

Prepared by gpt-6-astra through Codex (T3 Code).
