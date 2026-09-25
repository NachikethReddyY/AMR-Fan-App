# Merchandise discounts

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan redeems points for an admin-priced merchandise discount and can see its status in History.

## Accepted behavior

- Preserve discounts ranging from 10% to 60%, with point prices set by an admin. Larger discounts are intended to cost substantially more points; no price schedule is invented here.
- Fans can intentionally buy more than one voucher. A retry of one purchase does not charge twice or create another redemption.
- Apply [points and History](05-points-and-history.md) rules for insufficient points, changed prices, disabled offers, ownership and retained purchase history.
- Voucher fulfilment remains explicitly a demonstration until real merchant arrangements exist. A demo voucher must not be presented as a working external discount code.

## Depends on

[Accounts](01-accounts-and-demo.md), points and History, and admin offer/pricing controls.

## Before implementation

Choose the offer/history presentation. Real redemption, expiry and merchant integration require a separate fulfilment agreement; the POC does not invent them.

## Acceptance cases

| Scenario                                                              | Expected observation                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Admin configures 10% and 60% offers with point prices                 | Fan can see the configured discounts and prices; no invented fixed price schedule appears.    |
| A fan deliberately buys two vouchers, then retries the second request | Record two purchases and exactly two debits; the retry returns the second result.             |
| A voucher is a demo redemption                                        | Show demonstration fulfilment in the offer and History; do not claim a working merchant code. |
