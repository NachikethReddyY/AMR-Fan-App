# Rewards purchases

Issues [#14](https://github.com/NachikethReddyY/AMR-Fan-App/issues/14),
[#15](https://github.com/NachikethReddyY/AMR-Fan-App/issues/15) and
[#16](https://github.com/NachikethReddyY/AMR-Fan-App/issues/16) share the
[points operation](points.md#atomic-integration-contract). The three product
rules remain in feature documents [07](../features/07-tree-dedications.md),
[08](../features/08-exclusive-content.md) and
[09](../features/09-merchandise-discounts.md).

## Candidate status

The local domain and owned dispatcher candidate has PostgreSQL purchase,
catalogue and retained-right proof. Isolated admin assets use the existing dark
points-admin CSS. Actual API registration, admin/browser flow, application DAST
and phone integration are pending the serialized ownership handoff. Tests against
the real `createApi` currently fail because registration is absent. Passing module
tests does not complete the three issues. No real programme allocation, retailer
redemption, official content or live identity provider is configured.

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
request key binds the full edit; replay preserves the recorded version. A reward
cannot change product type. Catalogue responses never include locked content text.

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

## Local domain verification

Use only an infrastructure-provisioned worktree database pair. Shared service
lifecycle belongs to infrastructure. No peer credentials or fixed server port
are needed for domain tests.

```sh
pnpm install --frozen-lockfile
pnpm db:run-test -- node --test server/rewards/*.test.ts
pnpm check
pnpm security:check
```

The tests observe balance, History and receipts together through authenticated
operations, with real PostgreSQL concurrency and rollback. They cover retained
content/version access, explicit zero-point acknowledgements, tree/voucher
repeats, price/availability changes, funds, key conflicts, mixed purchases,
owner/real/demo/admin/session boundaries and immutable stored records. Both
simultaneous first unlocks and concurrent new-key repeat acknowledgements are
covered. Connection reopen is tested; actual process restart and registered HTTP
remain pending. Raw synthetic evidence stays in ignored `.evidence/rewards-14-16/`.

## Serialized registration handoff

The API/root owner must register these imports in `server/api/app.ts` after the
preceding integration owners release their paths:

```ts
import { dispatchRewards } from '../rewards/http.ts';
import { serveRewardsAdmin } from '../rewards/admin.ts';
```

For GET assets, call `serveRewardsAdmin(path, res)` alongside `serveAdmin` before
the bearer requirement. After the existing origin/rate guards and bearer parsing:

```ts
const rewards = await dispatchRewards({
  pool,
  token,
  method: req.method,
  path,
  query: Object.fromEntries(new URL(req.url ?? '/', 'http://api.invalid').searchParams),
  body: () => body(req),
});
if (rewards) return send(res, rewards.status, rewards.value);
```

The dispatcher owns no listener, origin policy, JSON reader, rate limit or error
envelope. It uses the existing API's 4,096-byte JSON cap. The plain-text field is
bounded at 2,000 characters; an encoded request above the byte cap must be shortened.
Unknown routes return `null`. The root owner should add `rewards:test:database`
and the matching CI step with **both** suites:

```sh
pnpm db:run-test -- node --test server/rewards/*.test.ts server/rewards/testing/registered-api.test.ts
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

## Pending acceptance, preserved failures and next proof

`server/rewards/testing/registered-api.test.ts` runs the actual API on ephemeral
loopback listeners, including a child-process restart. It is intentionally
separate from the currently passing module suite until the root owner registers
the handlers. The observed unregistered baseline has four failures: catalogue and
purchase paths return 404, the admin list returns 404, and the admin asset returns
401. Evidence: `07-registration-red.txt`. Do not skip these tests or substitute
a separate rewards-only server. Keep the newest-first History assertion when
integrating the points owner's sequence-order repair.

After registration, run both suites, existing points/account regressions and the
full checks. On an explicitly leased preview, observe assigned-admin create/edit/
disable, fan refusal, escaped text, price reconfirmation, purchase/History/content
access and sign-out/revocation. The phone confirmation and entitled viewer still
depend on the held native integration. Run isolated application DAST only after
the real API serves these routes/assets; document authenticated coverage separately
because an unauthenticated passive crawl cannot prove purchases or authorization.
Full browser/phone, physical fulfilment, live provider and deployment claims stay
pending. No PR or issue completion is implied by the committed local boundary.

Written by gpt-6-astra through Codex (T3 Code).
