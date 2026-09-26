# Rewards purchases

Issues [#14](https://github.com/NachikethReddyY/AMR-Fan-App/issues/14),
[#15](https://github.com/NachikethReddyY/AMR-Fan-App/issues/15) and
[#16](https://github.com/NachikethReddyY/AMR-Fan-App/issues/16) share the
[points operation](points.md#atomic-integration-contract). The three product
rules remain in feature documents [07](../features/07-tree-dedications.md),
[08](../features/08-exclusive-content.md) and
[09](../features/09-merchandise-discounts.md).

## Candidate status

The registered API and separate rewards admin page have actual PostgreSQL, HTTP,
process-restart and browser proof. The page reuses the existing dark points-admin
CSS. Phone confirmation, entitled viewer and navigation remain pending native
integration. This candidate does not complete the three issues. No real programme
allocation, retailer redemption, official content or live identity provider is
configured.

## Selected demonstration scope

Admins configure offers; the production catalogue starts empty. Content is
admin-authored plain text stored in PostgreSQL and delivered only after an owned
profile's entitlement check. Local fixtures use short original synthetic prose,
synthetic programme participation and 10%/60% discounts. Those examples are not
permanent catalogue limits or an automatic points price schedule.

Tree participation records the purchasing profile's name and explicitly retains
demonstration fulfilment. Discount receipts retain their configured percentage
and demonstration fulfilment. Neither represents actual allocation, verified
carbon removal or a working retailer code. Each POST purchases one participation,
one voucher or one content right; intentional repeat tree/voucher purchases use
new request keys. No quantity control, purchase cap, expiry, refund or access
revocation is introduced.

## Guest catalogue

The native Rewards tab defaults to Redemption. The explicit Home History action
still opens History. Signed-out fans can browse enabled offers with their stored
titles, descriptions and points prices, then use the existing Account entry to
sign in. Catalogue content is not a synthetic preview. An empty catalogue or
unavailable service is shown honestly.

Only `GET /v1/rewards/offers` is public, after the existing global rate limit and
browser-origin guard. Optional `limit` is 1 to 25 (default 25); optional `after`
is the last UUID cursor. Unknown query fields fail. Results contain `offers` and
`nextCursor`; current enabled versions use the same `publicOffer` projection as
authenticated reads, which excludes paid content text. No catalogue request
needs a session token or profile. The API must deploy this route before a new
mobile build can browse hosted rewards anonymously.

All mutations, profile-specific offers, balances, History, receipts, content,
submissions and admin access retain their existing authentication. Signed-in
redemption still re-reads the offer and confirms its current version and price.
The guest reader cancels publication on unmount; returning after logout starts a
fresh catalogue. It never supplies a fake authenticated context.

Local verification adds `server/rewards/testing/guest-api.test.ts`, intended only
for a disposable isolated `amr_c787guest_test` database, plus client catalogue
lifecycle/API tests. Real HTTP proof covers redaction, pagination, exact method
and path boundaries, origin checks and the rate limit. This does not establish
installed native or hosted deployment acceptance.

Edited by gpt-6-astra through Codex (T3 Code).

## Transaction and ownership

`server/rewards/index.ts` accepts the existing opaque session. A purchase supplies
only profile, offer, accepted offer version and request UUID. Identity, name,
price, balance and paid amount come from locked server data. Unknown fields fail.
`runPointsOperation` holds current authorization, request-key binding and the
owned profile lock, then returns any recorded success before fresh offer policy.
Fresh purchases lock the offer and check availability and accepted version. An
edit increments the version even if it changes only text or availability. Stale
confirmation fails without charge and requires reading and confirming the new
offer. The receipt, immutable History and debit commit or roll back together.

An existing content right is checked before fresh offer policy. A repeated POST
with a **new** request key appends one zero-point "Content already unlocked"
acknowledgement and returns the original purchase receipt. It creates no purchase,
right or fulfilment and counts as neither points spent/earned nor newly unlocked
content. That acknowledgement binds its key and payload; replay adds nothing.
GET content access creates no History. Even replay requires current authorization.

Admin edits require a current assigned role and expected version, serialize
against purchases and retain an immutable actor/time/version record. An admin
request key binds the full edit; replay preserves the recorded version. The owned
authority boundary checks the database clock again after the initial session-row
lock, before fresh operations or replay. A later profile-lock wait retains the
existing points contract. A reward cannot change product type. Catalogue responses never include locked content text.

Migration `0006_rewards.sql` stores immutable offer versions and immutable
profile-owned receipts linked to the existing points operation. A content right
is unique per profile/offer and retains the exact purchased text version. Editing
or disabling an offer cannot leave a dangling right. SQL triggers reject updates,
deletes and truncation of versions/receipts. The trusted schema owner remains
outside the untrusted application actor model.

## Retention and future reset integration

Real and demo profiles have independent balances, History, receipts and content
access, including when owned by the same principal. Catalogue configuration is
shared. Tree names and paid prices are snapshots. Later renames and points
corrections preserve them. Submissions/contributions are owned elsewhere and
untouched by this module.

[Account/demo rules](../features/01-accounts-and-demo.md#demo-reset) require future
reset to preserve purchases, content access, all History and shared contributions,
while clearing the selected demo balance and cancelling unfinished simulations.
This candidate implements no reset and claims no reset proof. The reset owner
must test that committed receipts and purchased text survive, other profiles and
shared contributions stay unchanged, stale unfinished requests cannot spend,
completed purchase replay returns the original receipt after current auth, and
reset replay cannot clear later earnings. Any reset generation check belongs
inside the existing operation callback after success lookup; coordinate that
shared integration rather than adding a second accounting interface.

## Local verification

Use only an infrastructure-provisioned worktree database pair. Shared service
lifecycle belongs to infrastructure. No peer credentials or fixed server port
are needed for domain tests.

```sh
pnpm install --frozen-lockfile
pnpm rewards:test:database
pnpm check
pnpm security:check
```

The tests observe balance, History and receipts together through authenticated
operations, with real PostgreSQL concurrency and rollback. They cover retained
content/version access, explicit zero-point acknowledgements, tree/voucher
repeats, price/availability changes, funds, key conflicts, mixed purchases,
owner/real/demo/admin/session boundaries and immutable stored records. Both
simultaneous first unlocks and concurrent new-key repeat acknowledgements are
covered. The database script runs both the top-level rewards tests and
`server/rewards/testing/registered-api.test.ts` serially. The latter starts the real
`createApi`, including a child-process restart with the same stored receipt/text.
The suites need at most two temporary loopback listeners in total. Stop a leased
fixed API before running them. Raw synthetic evidence stays in ignored
`.evidence/rewards-14-16/`.

## API registration

`server/api/app.ts` imports `dispatchRewards` from `server/rewards/http.ts` and
`serveRewardsAdmin` from `server/rewards/admin.ts`. GET assets are served beside
the existing admin assets before the bearer requirement. The dispatcher runs
after the existing origin/rate guards and bearer parsing, with the existing
bounded JSON body callback and query parameters. Accounts, points, routes and
journeys keep their registration.

The dispatcher owns no listener, origin policy, JSON reader, rate limit or error
envelope. It uses the existing API's 4,096-byte JSON cap. The plain-text field is
bounded at 2,000 characters; an encoded request above the byte cap must be shortened.
Unknown routes return `null`. `pnpm check` includes the rewards HTTP unit tests;
`pnpm rewards:test:database` and its CI step run **both** database suites:

```sh
pnpm db:run-test -- node --test --test-concurrency=1 server/rewards/*.test.ts server/rewards/testing/registered-api.test.ts
```

| Route | Method and result |
| --- | --- |
| `/v1/admin/rewards/offers` | GET paged full offers, POST create, PATCH expected-version edit; assigned admin only |
| `/v1/profiles/:id/rewards/offers` | GET owned-profile available catalogue without content text |
| `/v1/profiles/:id/rewards/offers/:offerId` | GET current confirmation price/version/availability without content text |
| `/v1/rewards/purchases` | POST `profileId`, `offerId`, `offerVersion`, UUID `requestId`; 201 with History entry and original receipt |
| `/v1/profiles/:id/rewards/receipts` | GET profile-owned retained receipts |
| `/v1/profiles/:id/rewards/content/:offerId` | GET purchased text version and original receipt, including disabled offers |

Catalogue and receipt lists accept UUID `after` and `limit` 1–100, default 25.
They page by stable UUID; points History owns chronological ordering. Admin
create accepts `requestId`, `enabled` and a product discriminated by `kind`.
All products contain `title`, `description` and positive whole `pointsPrice`;
content adds `text`, discount adds integer `percentage` 10–60. Edit also requires
`offerId` and `expectedVersion`. Retired/disabled means `enabled: false`; there is
no destructive catalogue deletion or purchased-right revocation API.

The static page is `/admin/rewards/`, with `/admin/rewards/app.js`; it reuses
`/admin/style.css`, `/admin/config` and account session endpoints. Sign-in uses
the existing explicit local synthetic selector. A server-assigned admin role is
required. Credentials stay in page memory; reload requires sign-in. A failed
unchanged edit retries its existing key, while a version conflict requires loading
the current offer. Live admin sign-in remains pending provider configuration.

## Observed acceptance and remaining proof

The actual unregistered baseline had four failures: catalogue and purchase paths
returned 404, the admin list returned 404, and the admin asset returned 401.
Registration makes those assertions pass without a separate rewards-only server.
The newest-first History assertions remain intact.

On a leased loopback API and owned T3 preview, the synthetic admin created tree,
10%/60% voucher and plain-text content offers, changed price/availability and
edited content. Literal markup stayed text; the 390-pixel viewport had no
horizontal overflow. Keyboard Tab moved between price and discount controls.
A fan was refused admin access. Current role revocation refused an edit and
cleared the editor. A stale concurrent edit required reload. A deliberately lost
response after a real successful POST retried to the same catalogue version,
without another offer. Sign-out cleared the workspace.

Actual HTTP requests against that same process bought the browser-created content,
then retrieved its original text and receipt after browser edits and disablement.
Same-key replay preserved the result; a new content key acknowledged zero points.
The other profile could not read that content or buy the disabled offer. Tree and
10%/60% voucher receipts retained their paid snapshots and demonstration status.
These requests are HTTP purchase proof, not a phone purchase interface.

The isolated passive DAST target starts at `/admin/rewards/`. The optional target
pathname defaults to `/` and accepts only plain bounded path segments, rejecting
scheme/authority substitution, traversal, encoded ambiguity, query and fragment.
The origin, internal container network and scan rules stay fixed. An
unauthenticated crawl cannot prove owned content, catalogue authority or accounting;
the authenticated HTTP/PostgreSQL tests provide that evidence separately. The
observed ZAP 2.17.0 report passed the existing policy with one informational
Modern Web Application alert and eight GET endpoints. Its diagnostic insights
reported 11 errors and 54% network failures. A task-local capture of the final
scanner log contained 18 ERROR records: 12 failed update-service DNS lookups,
four failed telemetry-service DNS lookups and two failed-update messages. These
requests were blocked by network isolation; no telemetry or remote access was
enabled. Earlier safe/unsafe reports each counted five errors, but their raw
logs were not retained, so an exact baseline comparison remains unverified.
This is limited passive coverage, not an error-free or authenticated scan claim.

Phone presentation, demo reset, physical fulfilment, live provider and deployment
acceptance remain open. Future reset integration must run the exact retained-right
and generation checks described above. Independent exact-candidate review and
hosted check status belong to the PR handoff, not to these local behavior claims.

Written by gpt-6-astra through Codex (T3 Code).
