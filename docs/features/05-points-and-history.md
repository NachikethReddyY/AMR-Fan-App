# Points, Rewards and History

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan earns or receives points, spends them once and can understand every change in Rewards History.

## Journey awards

- Initial settings are 50 points per estimated kilogram reduced and a 2,000-point cap per eligible journey. Admins may change future earning rules.
- Eligible ordinary travel can cover the supported country. There is no race-destination restriction, race-weekend restriction, daily trip-count limit or additional daily points cap. Duplicate credit for one journey is prohibited.
- Example arithmetic: 10 kg gives 500 points; 60 kg reaches the 2,000-point cap. These are not typical Singapore route estimates. Final rounding and evidence thresholds must be defined before implementation.
- Qualifying completion settles a real journey under its Start journey rule/factor versions. Provisional changes never remove points earned before that journey. Simulation awards remain confined to demo profiles.
- With missing intervening GPS, award the smaller of 50 points and the expected journey award only if both start and arrival were recorded. Expected awards of 120 and 20 give fallbacks of 50 and 20. Missing either endpoint gives no fallback.
- Retain the fallback reason and evidence status in History. The award does not establish verified travel or verified avoided emissions.
- If later evidence supports a higher award, credit only the difference for the same journey. A fallback of 50 followed by an assessed total of 120 adds 70. Append the top-up and retain the original record; repeated evidence or settlement must not add the difference again.
- An admin rule/factor edit cannot change a journey's retained basis. Evidence-based top-ups are explicit additional records, not retroactive edits to the original transaction. Automatic downward recovery is not approved; existing reason-recorded admin adjustments remain available.

## Spending and records

- Rewards has exactly two tabs: Redemption and History. Redemption contains fan submissions, tree dedications, exclusive content and merchandise discounts. The unified submission feature supersedes the earlier separate question/challenge count.
- History shows every point change, its reason and resulting balance alongside reward statuses. Prepared illustrative history remains labelled and cannot create spendable points or purchased rights.
- Keep authorization, the non-negative balance, current price/eligibility, debit or credit, History and the reward outcome consistent in one operation. A repeated successful request returns its original outcome without another charge or award.
- A changed offer price before confirmation requires fresh confirmation. Completed purchases retain their accepted price. A disabled offer rejects new purchases without charge and preserves previous redemptions and access.
- Intentional repeat tree participations, vouchers and paid fan submissions are new purchases. Previously unlocked exclusive content is not charged again.
- An authorized admin can add/remove points with a recorded reason. Corrections append a new record, preserve the original transaction and reward, and cannot make the balance negative. Removing points does not automatically revoke rewards.

## Depends on

[Accounts](01-accounts-and-demo.md). Spending can be built with admin-granted points while [journey tracking](04-journey-tracking.md) and [emissions estimates](03-emissions-estimates.md) are prepared. Demo-reset behavior belongs to the account feature.

## Before implementation

Prove concurrency and replay protection through the authenticated points/rewards interface. Select whole-point rounding and verified evidence thresholds before calculated awards. The [module design](../points-rewards-design.md) records the agreed implementation responsibility; it does not require another deployment or a service per feature.

## Acceptance cases

| Scenario                                                                                              | Expected observation                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real account completes an eligible journey with sufficient location evidence                          | Settle the calculated award once; update balance, History and personal impact consistently under the journey's retained rule/factor versions.                                                    |
| GPS evidence is missing but the app recorded start and arrival; expected award is 120                 | Credit a 50-point fallback once, show its reason and retain the evidence status; do not mark the journey verified or remove earlier earned points.                                               |
| GPS evidence is missing but the app recorded start and arrival; expected award is 20                  | Credit a 20-point fallback once. GPS failure cannot increase the award above the expected amount.                                                                                                |
| A fallback of 50 points later receives evidence supporting 120 points                                 | Append a 70-point top-up for the same journey, retain both records and update the evidence status. Replaying the evidence or request adds nothing further.                                       |
| Fan opens Rewards                                                                                     | Redemption and History are the two tabs.                                                                                                                                                         |
| Fan opens Redemption                                                                                  | Fan submissions support both questions and proposed activities; tree dedications, exclusive content and merchandise discounts remain available.                                                  |
| Fan opens History                                                                                     | Personal transactions and reward statuses are consistent with the account balance; prepared illustrative records are labelled separately and do not create spendable points or purchased rights. |
| Fan earns points from multiple qualifying journeys in one day                                         | Apply each journey's configured cap without an additional daily points cap; retries still cannot award twice.                                                                                    |
| Eligible journey has 10 kg estimated reduction under initial earning settings                         | Credit 500 points once under the final eligibility policy.                                                                                                                                       |
| Eligible journey has 60 kg estimated reduction under initial earning settings                         | Credit no more than 2,000 points once.                                                                                                                                                           |
| Admin adjusts a balance                                                                               | Record the authorized change and its reason; preserve transaction history and the non-negative balance invariant.                                                                                |
| Admin changes the rate from 50 to 25 points/kg while a journey is active                              | That journey completes with its start version of 50; a new journey uses 25. Historical awards remain unchanged.                                                                                  |
| Admin grants a real account points and the fan redeems a reward                                       | Deduct points once; record History; disclose demonstration fulfilment for vouchers, trees and driver outcomes.                                                                                   |
| Admin changes an offer from 100 to 150 points before confirmation                                     | Display 150 and require fresh confirmation; make no debit or redemption from the stale confirmation.                                                                                             |
| Admin changes an offer after completed redemption                                                     | Preserve the completed redemption's accepted price and history.                                                                                                                                  |
| Fan opens History after a journey award, purchase and admin adjustment                                | Show each point change, reason and resulting balance alongside reward statuses.                                                                                                                  |
| Fan intentionally buys a second tree participation or store voucher, or submits another paid question | Create a separate charged purchase, distinct from a retry.                                                                                                                                       |
| An offer is disabled before purchase confirmation                                                     | Refuse without charge; preserve prior redemptions and content access.                                                                                                                            |
| Admin corrects an erroneous point transaction                                                         | Append a reason-recorded adjustment; keep the original and existing reward; refuse a deduction that would make balance negative.                                                                 |
| Two purchases or two copies of a top-up arrive concurrently                                           | Keep one consistent balance and outcome; no double spend, duplicate top-up or negative balance.                                                                                                  |
