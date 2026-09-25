# Accounts and demo mode

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan signs in on the iOS/Android phone app, keeps their progress across devices and can use a clearly labelled demo profile.

## Accepted behavior

- Retain Expo/React Native and the existing Home, Travel, Rewards and Impact navigation. Email accounts and shared progress are in scope; the authentication provider is not selected.
- Every new real account and demo profile starts with 0 points. Prepared catalogues and dashboard examples do not grant points or fabricate personal transactions.
- Each signed-in user has one persistent demo profile across devices and visits. Resuming it never issues a new starting balance.
- Demo journeys are simulated and clearly labelled. They can award points only to the demo profile, which can spend them and update its own History and dashboard. Real accounts earn eligible actual-journey awards and can spend authorized admin grants.
- Personal balances, History and content access remain independent. Demo and real contributions share the fan-submission ranking as specified in [fan submissions](06-fan-submissions.md).
- Vouchers, tree participation and driver outcomes retain demonstration fulfilment until arrangements exist.

## Demo reset

An assigned admin resets only the selected demo profile. Clear its remaining balance to 0 with a reason-recorded History entry; preserve purchased rewards, unlocked content, submissions, all History, shared contributions and selections. Restart simulated journeys and dashboard examples without changing another account's personal state or duplicating/removing shared votes.

Cancel unfinished simulated journeys and require fresh confirmation for unfinished purchases and contributions. Late requests from before reset cannot award or spend points. Preserve completed outcomes and return their recorded result on replay. Retrying a completed reset must not clear points earned afterwards. Repeating a reset at 0 creates no points.

## Depends on

Authentication and persistent account ownership. Point mutations use [points and History](05-points-and-history.md); this feature owns demo identity and reset behavior.

## Before implementation

Select the authentication provider and Azure persistence, and agree sign-in/demo controls within the accepted visual design. The first account slice can ship before demo reset and reward integrations.

## Acceptance cases

| Scenario                                                                                | Expected observation                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fan uses the iOS or Android app                                                         | The fan experience remains a native Expo/React Native phone app.                                                                                                                                                                                                            |
| Fan starts a demo journey                                                               | Simulation is clear; no claim of actual GPS-verified travel is made.                                                                                                                                                                                                        |
| Demo fan completes a simulated journey and spends its credited points                   | Balance, History and applicable dashboard records update consistently with demo status retained.                                                                                                                                                                            |
| A completed demo operation is retried                                                   | It produces no second award or spend.                                                                                                                                                                                                                                       |
| A real user signs in                                                                    | Their own account/progress is available; demo records do not become their real activity.                                                                                                                                                                                    |
| Real account completes a simulated journey                                              | Award no simulated points to that account.                                                                                                                                                                                                                                  |
| Admin resets demo data                                                                  | Reset only the selected persistent demo profile; preserve its rewards, submissions and History, shared votes/selections and other accounts' personal state. Return the balance to 0 with a reset entry; cancel unfinished journeys and require fresh purchase confirmation. |
| Demo user A spends points or resets progress                                            | Demo user B's personal balance and History remain unchanged. Submission contributions intentionally affect the shared ranking; reset preserves those contributions and grants no starter points.                                                                            |
| A new real account signs in without an admin grant                                      | It receives no automatic starter points and cannot earn simulated journey points.                                                                                                                                                                                           |
| A new demo profile is created                                                           | Balance starts at 0; populated catalogue/dashboard examples do not credit the balance.                                                                                                                                                                                      |
| Demo user returns on another device or after signing in again                           | Resume the same demo profile and its current balance, rewards and History; issue no starting points.                                                                                                                                                                        |
| Demo earns or receives 1,000 points, buys content for 400, contributes 300, then resets | Preserve content access, the 300 shared votes, selections, submissions and all History. Balance becomes 0 with a reset debit of 300.                                                                                                                                        |
| That demo resets again without further activity                                         | Preserve rights and shared votes; never create starter points or duplicate contributions.                                                                                                                                                                                   |
| Reset occurs while a simulated journey or purchase is unfinished                        | Cancel the journey; require fresh purchase confirmation; reject late pre-reset awards/spending. Preserve already committed outcomes.                                                                                                                                        |
| A completed reset is retried after a new award                                          | Return its recorded outcome; do not clear the new points or append another reset debit.                                                                                                                                                                                     |
