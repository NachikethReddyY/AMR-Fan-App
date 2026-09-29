# Backend brief: merch offers, coupons, and Race IQ

Design the backend contract for the Swift fan app. Do not assume that the
current local Swift state is production data. Propose exact routes, request
schemas, response schemas, authorization rules, and idempotency behavior for
the following requirements.

## Merchandise catalog and offers

- Ingest the official product catalog with stable `productId`, name, image,
  store URL, source category, normalized app category, driver ownership
  (`Fernando Alonso`, `Lance Stroll`, `Team`, or null), and stock status.
- Treat `Sweatshirt` and `Midlayer` as `Outerwear`; `Headwear` as `Caps`;
  `T-shirt` and `Polo` as `T-shirts`; and accessories, bags, watches, flags,
  toys, drinkware, footwear, and lanyards as `Other`.
- Give admins an offer editor. An offer must support `productId`, `active`,
  `discountPercent`, `pointsCost`, `stockStatus`, `startsAt`, and `endsAt`.
- Define a public authenticated offer-listing operation. The client must be
  able to filter by normalized category and selected driver without using
  product-name guessing.

## Claiming and coupons

- Define an atomic claim operation that authenticates the profile, validates
  the active offer and stock, checks the points balance, deducts points, and
  creates a coupon in one transaction.
- Require a client request/idempotency ID so retries cannot deduct points or
  create duplicate coupons.
- Return a coupon containing at least `code`, product name, discount,
  points spent, created date, expiry, and status.
- Define a fan coupon-list operation. Coupons should be returned as a list,
  not embedded in a single reward placeholder.
- Record an admin audit event for offer edits and claims, including actor,
  profile, product, points ledger entry, and request ID.

## Race IQ daily reward

- Define the quiz-content source and an operation that submits an answer set
  or completion proof without trusting a client-provided score.
- Enforce one successful reward claim per profile per agreed calendar day
  (state whether the product uses UTC or a profile timezone).
- Make completion and the points-ledger entry atomic and idempotent.
- Return eligibility, reward amount, claim status, and the next eligible day.

## Integration guardrails

- Keep the Swift client free of invented routes until this design is accepted.
- Specify validation and error responses for inactive offers, unavailable
  stock, insufficient points, duplicate request IDs, already-claimed daily
  quizzes, and expired offers.
- State which fields are admin-controlled, which are source-catalog fields,
  and which are derived for display.
