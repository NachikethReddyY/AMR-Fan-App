# Points and rewards module discussion

Status: module responsibility and reset policy confirmed by the user. Implementation is not authorized. No domain implementation exists yet. Journey calculation policy and ESG totals are explicitly deferred.

## Clarity status

| Dimension | Status | Evidence and sample | Confidence and limits |
| --- | --- | --- | --- |
| Existing code to deepen | None | Entire starter runtime: index.ts and src/App.tsx; planned Convex directory | High; this is future module design, not a refactor. |
| Confirmed consistency rules | Defined | Current spec sections on points, rewards and admin operations | High for intent; no executed behavior. |
| Reward interaction completeness | Confirmed for current scope | Five reward types and consolidated reset confirmation | History, repeats, shared rankings, disabled offers and corrections are settled; zero-start persistent demo profiles preserve rewards, History and shared contributions; reset clears the balance to 0 and cancels unfinished simulated journeys. |
| Calculation dependency | Deferred | User's explicit Q7 answer | Does not block spending authorized admin-granted points; blocks finalized calculated journey awards. |

## Agreed module responsibility

The points and rewards module owns the consistency of point changes and their associated reward outcomes. Its implementation keeps authorization, available-balance checks, accepted prices, retry identity, transaction records and reward effects together. Fan and admin callers cross the same seam and cannot write a balance separately from the recorded outcome.

This produces locality for accounting rules and leverage across reward purchase, challenge submission/contribution and admin adjustments. Depth is a design aim, not an observed property of the starter. The deletion test will be meaningful only after implementation: deleting this module should force its consistency rules back into several callers.

Keep the existing Convex direction. This does not prescribe a separate package, a new deployment, a generic repository interface or a provider framework. There is no evidence of two real adapters requiring an additional seam today.

## Agreed interface responsibilities, in business terms

| Caller intent | What the caller supplies | What the module owns | Observable result |
| --- | --- | --- | --- |
| Read my points/rewards | Authenticated context and requested page/filter | Ownership, balance, entitled content and history visibility | Current balance, permitted offers, all point changes with reasons/resulting balances and reward statuses. |
| Perform a fan reward action | Stable request identity, reward/challenge target, action-specific payload, accepted offer version or contribution amount | Authorization, validation, current eligibility/price, funds, one-time deduction and associated outcome | A recorded success or a refusal without partial changes. |
| Adjust points as admin | Stable request identity, target account, signed amount and reason | Assigned admin role, non-negative resulting balance and immutable historical record | A new adjustment with a reason; original transactions and existing rewards remain intact. |
| Reset demo progress as admin | Authenticated admin context, target demo profile and stable request identity | Zero balance, appended History, cancellation of unfinished journeys, fresh confirmation for unfinished purchases and retained rights/shared votes | Recorded reset result; retry cannot clear later earnings. |
| Record an assessed journey award | Trusted journey record identity | Demo eligibility for this prototype, completed-assessment lookup, start-version reference and one-time award | Existing outcome on replay, or one new award. Calculation policy is deferred; no arbitrary client credit amount is accepted. |

These are agreed interface responsibilities, not final function names or a single untyped command accepting arbitrary fields. Reward-specific data must remain explicit: a question contains question text; a contribution contains an amount; an exclusive-content purchase identifies the content. No TypeScript shape is chosen here.

Interface error behavior should distinguish insufficient points, changed price requiring reconfirmation, unavailable reward, unapproved/frozen challenge, unauthorized caller and invalid action. A replay of an already successful request returns the original outcome. A new intentional purchase is distinct from a replay. Intentional repeat tree/voucher/question purchases are allowed; previously unlocked content is not charged again.

## Confirmed invariants

- No negative point balance, duplicate award, duplicate charge or partial reward outcome.
- Initial earning settings: 50 points/kg and 2,000 per journey, with no daily trip-count limit. Admins may change future rules. The module does not decide the deferred emissions formula.
- Journey awards retain Start journey rule/factor versions; completed awards do not change.
- Every demo profile and real account starts at 0 points. Only demo profiles earn simulated journey points. Real accounts spend admin grants. Each signed-in user resumes one persistent demo profile across visits/devices.
- A changed reward price requires fresh confirmation. Completed purchases retain the accepted price.
- Question fees and challenge submission/contribution fees follow their confirmed no-refund rules. A rejected challenge resubmission is a new 500-point submission.
- Exclusive content stays unlocked after redemption.
- Selected challenges stop accepting contributions and cannot be selected again until resolved. An admin can mark performed or release back to backlog; retained points are not refunded.
- Tree participation uses the account name and admin-set price; no quote or country reassignment.
- Demo and real accounts contribute to shared challenge rankings. Personal balances and History remain independent; reset preserves shared contributions, purchased rewards/content, submissions and all point History. It grants no starting points.
- History includes all point changes and reward statuses.
- Disabled offers reject new purchases without charge and preserve earlier rights.
- Corrections append reason-recorded adjustments; preserve original transactions and rewards, and never make a balance negative.

## Dependencies and test seam

Authentication and persistence are required by the existing Convex direction. Exercise the module through its authenticated interface and observe the balance, History and reward outcome together. Pure validation can remain internal to the implementation; do not expose it solely for tests.

Routing and AI calls are external to the atomic point mutation. Reward spending does not require either. Actual merchant fulfilment and actual planting are outside the prototype; demonstration records must not become invented partner integrations.

Primary-source feasibility and testing limitations are recorded in [the research note](research/spec-feasibility.md). Platform transaction guarantees are not proof that application ownership and replay rules are correct.

## Verification cases for later implementation

- Two concurrent purchases cannot spend the same available points twice; observe outcomes and final balance.
- Replaying one successful purchase returns its original outcome without another deduction.
- A price change between display and confirmation returns reconfirmation without a charge.
- Fan-originated admin requests and another user's record IDs cannot modify protected records.
- Selected-challenge contributions fail without changing balance or ranking.
- Demo reset preserves other accounts' personal balances/history/access; its own purchased rewards, submissions, History and shared contributions remain unchanged. Reset returns its balance to 0, records the change and rejects stale unfinished writes while preserving completed outcomes.
- Previously purchased exclusive content stays unlocked even if the offer is disabled; another request does not charge again.
- A real account cannot obtain simulated journey credit.

No tests have been implemented or executed for these behaviors.

## Reset contract after zero-start decision

The latest answers replace seeded balances: everyone starts at 0, rewards and History survive reset, and each signed-in user has one persistent demo profile. Debit-source ordering is no longer needed for starter points because no starter points exist. Demonstration catalogues and dashboard examples remain populated; illustrative data cannot silently credit a personal balance or create purchased rights.

Reset also preserves challenge submissions, shared contributions, ranking totals, existing selections and other accounts' personal data. A return visit resumes the same profile without a fresh balance or separate anonymous identity.

Agreed reset interface responsibility: an assigned admin supplies the target demo profile and stable request identity. The module atomically sets its available balance to 0, appends a reset entry to History, and restarts simulated journey/dashboard state while preserving the records above. For example: 0 + 1,000 in awards/grants - 400 content - 300 contribution = 300 before reset; reset adds -300, leaving 0. Purchased access and the 300 votes survive. Repeating a successful reset request returns its recorded result and cannot clear points earned after that reset.

Agreed unfinished-operation policy: preserve outcomes committed before reset; cancel unfinished simulated journeys and require fresh confirmation for unfinished purchases/contributions. Late pre-reset requests cannot award or spend points. Replay of a completed purchase still returns its original outcome. A reset generation checked by each committing mutation is one implementation option, not an approved architecture requirement.

The user accepted the zero-reset balance, unfinished-operation policy and module responsibility in the consolidated confirmation. Calculation policy and ESG metrics remain explicitly deferred. No implementation or runtime verification is implied.
