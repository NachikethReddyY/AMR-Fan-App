# Exclusive content

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan spends points to unlock admin-provided content and keeps access on later visits.

## Accepted behavior

- Admins manage content and set its points price, including off-season content.
- Successful redemption permanently unlocks that content for the purchasing account.
- Another request for already unlocked content must not charge again. Disabling an offer does not remove earlier access.
- Apply [points and History](05-points-and-history.md) rules for ownership, funds, price reconfirmation, disabled offers and retry-safe purchases.
- Demo reset preserves content access; another account does not inherit it.

## Depends on

[Accounts](01-accounts-and-demo.md), points and History, and admin content/price controls.

## Before implementation

Select actual permitted content and storage/delivery. Avoid assuming a format, rights agreement or external content service that has not been selected.

## Acceptance cases

| Scenario                                             | Expected observation                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Fan returns to previously redeemed exclusive content | Content remains unlocked for that account.                                 |
| Fan requests exclusive content already unlocked      | Preserve access without another charge.                                    |
| An admin disables content after the fan unlocked it  | Preserve the fan's access; new unentitled purchases fail without a charge. |
