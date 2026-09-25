# Points and rewards module discussion

Status: module responsibility and reset policy confirmed by the user. Implementation is not authorized. No domain implementation exists yet. The confirmed feature specifications own the product rules; numerical inputs and implementation choices remain listed there.

## Clarity status

| Dimension | Status | Evidence and sample | Confidence and limits |
| --- | --- | --- | --- |
| Existing code to deepen | None | Entire starter runtime: index.ts and src/App.tsx; backend not implemented | High; this is future module design, not a refactor. |
| Confirmed consistency rules | Defined | Current spec sections on points, rewards and admin operations | High for intent; no executed behavior. |
| Reward interaction completeness | Confirmed for current scope | Unified fan submissions, tree dedications, exclusive content, store discounts and consolidated reset confirmation | History, repeats, shared ranking, disabled offers and corrections are settled; zero-start persistent demo profiles preserve rewards, History and shared contributions; reset clears the balance to 0 and cancels unfinished simulated journeys. |
| Calculation dependency | Product choices confirmed; inputs pending | Approved car baseline, fastest-route time reference and difference-only top-ups | Factor selection, units, rounding and evidence thresholds still gate calculated awards. |

## Agreed module responsibility

The points and rewards module owns the consistency of point changes and their associated reward outcomes. Its implementation keeps authorization, available-balance checks, accepted prices, retry identity, transaction records and reward effects together. Fan and admin callers cross the same seam and cannot write a balance separately from the recorded outcome.

This keeps accounting rules together across reward purchases, fan submissions, votes and admin adjustments. Depth is a design aim, not an observed property of the starter. The deletion test will be meaningful only after implementation: deleting this module should force its consistency rules back into several callers.

Implement this module in the Azure backend when its services are selected. This does not prescribe a separate package, a new deployment, a generic repository interface or a provider framework. There is no evidence of two real adapters requiring an additional seam today.

## Agreed interface responsibilities, in business terms

| Caller intent | What the caller supplies | What the module owns | Observable result |
| --- | --- | --- | --- |
| Read my points/rewards | Authenticated context and requested page/filter | Ownership, balance, entitled content and history visibility | Current balance, permitted offers, all point changes with reasons/resulting balances and reward statuses. |
| Perform a fan reward action | Stable request identity, reward or submission target, action-specific payload, accepted offer version or contribution amount | Authorization, validation, current eligibility/price, funds, one-time deduction and associated outcome | A recorded success or a refusal without partial changes. |
| Adjust points as admin | Stable request identity, target account, signed amount and reason | Assigned admin role, non-negative resulting balance and immutable historical record | A new adjustment with a reason; original transactions and existing rewards remain intact. |
| Reset demo progress as admin | Authenticated admin context, target demo profile and stable request identity | Zero balance, appended History, cancellation of unfinished journeys, fresh confirmation for unfinished purchases and retained rights/shared votes | Recorded reset result; retry cannot clear later earnings. |
| Record an assessed journey award | Trusted journey record identity | Eligibility for a real journey or its missing-GPS fallback, or a labelled simulation confined to a demo profile; recorded assessment, start-version reference and one-time settlement | Existing outcome on replay, one new settlement, or a difference-only top-up for later evidence; use the same journey identity and retained versions. No arbitrary client credit amount is accepted. |

These are agreed interface responsibilities, not final function names or a single untyped command accepting arbitrary fields. Reward-specific data must remain explicit: a fan submission contains question or proposed-activity text; a contribution contains an amount; an exclusive-content purchase identifies the content. No TypeScript shape is chosen here.

Interface error behavior should distinguish insufficient points, changed price requiring reconfirmation, unavailable reward, unapproved/frozen submission, unauthorized caller and invalid action. A replay of an already successful request returns the original outcome. A new intentional purchase is distinct from a replay. Intentional repeat tree/voucher purchases and fan submissions are allowed; previously unlocked content is not charged again.

## Product rule owners

Detailed behavior and acceptance cases live in the feature specification:

- [Points and History](features/05-points-and-history.md) owns awards, fallbacks, top-ups, spending, corrections and replay protection.
- [Accounts and demo](features/01-accounts-and-demo.md) owns identity, isolation and reset.
- [Fan submissions](features/06-fan-submissions.md) owns paid moderation, voting, selection and fulfilment.
- [Trees](features/07-tree-dedications.md), [content](features/08-exclusive-content.md) and [discounts](features/09-merchandise-discounts.md) own their purchase outcomes.
- [Emissions](features/03-emissions-estimates.md) and [journey tracking](features/04-journey-tracking.md) supply assessed values under retained rule/factor versions.

Keep accounting and outcome changes atomic through this module's authenticated interface. A feature split is documentation structure, not a request for separate backend services.

## Dependencies and test seam

Authentication and persistence are required by the agreed behavior. Exercise the module through its authenticated interface and observe the balance, History and reward outcome together. Pure validation can remain internal to the implementation; do not expose it solely for tests.

Routing and AI calls are external to the atomic point mutation. Reward spending does not require either. Actual merchant fulfilment and actual planting are outside the prototype; demonstration records must not become invented partner integrations.

Primary-source feasibility and testing limitations are recorded in [the research note](research/spec-feasibility.md). Platform transaction guarantees are not proof that application ownership and replay rules are correct.

## Verification responsibilities

Use the feature acceptance cases through the same interface as fan and admin callers. Observe balance, History and reward outcome together. Include concurrency, replay, changed-price reconfirmation, unauthorized caller/record access, disabled offers and later-evidence top-ups. Integration fixtures may isolate external providers; they cannot prove physical travel.

Demo reset must preserve committed outcomes, invalidate unfinished operations and leave later earnings untouched when a completed reset is replayed. A reset generation checked by committing mutations is one implementation option, not an approved architecture requirement.

No application behavior has been implemented or verified by this design discussion.
