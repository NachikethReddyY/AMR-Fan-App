# Rewards purchases

Issues [#14](https://github.com/NachikethReddyY/AMR-Fan-App/issues/14),
[#15](https://github.com/NachikethReddyY/AMR-Fan-App/issues/15) and
[#16](https://github.com/NachikethReddyY/AMR-Fan-App/issues/16) share the
[points operation](points.md#atomic-integration-contract). The three product
rules remain in feature documents [07](../features/07-tree-dedications.md),
[08](../features/08-exclusive-content.md) and
[09](../features/09-merchandise-discounts.md).

## Candidate status

The local domain candidate has PostgreSQL purchase, catalogue and retained-right
proof. Actual API registration, admin/browser flow, application DAST and phone
integration are pending the serialized ownership handoff. Passing domain tests
does not complete the three issues. No real programme allocation, retailer
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
pnpm db:run-test -- node --test server/rewards/rewards.test.ts
pnpm check
pnpm security:check
```

The tests observe balance, History and receipts together through authenticated
operations, with real PostgreSQL concurrency and rollback. They cover retained
content/version access, explicit zero-point acknowledgements, tree/voucher
repeats, price/availability changes, funds, key conflicts, mixed purchases,
owner/real/demo/admin/session boundaries and immutable stored records. Connection
reopen is tested; actual process restart and registered HTTP remain pending.
Raw synthetic evidence stays in ignored `.evidence/rewards-14-16/`.

Written by gpt-6-astra through Codex (T3 Code).
