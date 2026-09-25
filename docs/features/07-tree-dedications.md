# Tree dedications

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan spends points on participation in an existing tree programme and sees the dedication under their account name.

## Accepted behavior

- An admin sets the price in points. Record participation under the purchasing account name.
- Retain demonstration status until actual programme allocation is arranged. A seeded record or point redemption does not prove an extra tree was planted or establish verified carbon removal.
- The demo has no optional quote or country-reassignment controls. Earlier new-planting/reassignment proposals are historical.
- A fan can intentionally buy another participation. Distinguish a new purchase from retrying the first one.
- Apply [points and History](05-points-and-history.md) rules for price changes, disabled offers, insufficient points and one-time debits. Keep the dedication and its status in History.

## Depends on

[Accounts](01-accounts-and-demo.md), points and History, and an admin-priced programme offer.

## Before implementation

Choose the offer and confirmation presentation. Real allocation requires an actual programme arrangement; do not invent a planting partner or fulfilment integration.

## Acceptance cases

| Scenario                                                                                 | Expected observation                                                                                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Fan views a demo tree record                                                             | It describes programme participation and remains a demonstration pending actual allocation.                                   |
| Fan redeems tree participation                                                           | Display the admin price and record participation under the account name, without quote or country-reassignment controls.      |
| A completed tree purchase is replayed, then the fan deliberately makes a second purchase | Replay preserves the original record without another charge; the intentional purchase produces a separate paid participation. |
