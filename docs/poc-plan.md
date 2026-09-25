# Sustainable fan travel: working POC plan

Status: interview in progress; not an implementation specification.

## Source and precedence

Based on the user's AI-extracted brief supplied on 25 September 2026, attributing the idea to meeting notes from 22 and 24 September and follow-up messages at 10:30–10:32 pm on 24 September. Original notes and messages have not been inspected.

Within the supplied meeting brief, everyday public transport journeys were central. The latest direct user clarification sets local travel to a selected race as the first feature and demo within the broader fan app. It supersedes the earlier brief for the immediate build; arbitrary everyday destinations are not required for this first feature.

## Current agreed feature boundary

- The product remains an Aston Martin F1 fan app. The first build includes race travel, creating driver/team challenges, contributing points to challenges, and a rewards store.
- The fan is already in the race's country/location and travels from their current location to the selected race. Return travel from the race is also reward-eligible within the agreed window. Examples supplied were Singapore to a Singapore race, Malaysia to a Malaysian race, and the US to a US race.
- These examples describe the intended local-travel pattern across race locations. They do not establish a verified current race calendar or an agreed launch catalog.
- International travel to the host country is outside the described first journey.
- Compare route options by time and estimated emissions, with more points for lower-carbon travel. Calculation and award rules remain open.
- Changed or interrupted journeys must be reflected in the app and lead to an appropriate points deduction, as requested by the user. Whether this reduces provisional journey points, removes previously earned points, or applies a penalty remains unresolved; no numeric deduction rule is agreed.
- Transport choices include buses, MRT/rail, walking, cycling, and cabs. Public transport routes may mix modes and walking connections; a cab is a separate route, not a cab-plus-transit combination.
- Build for both iOS and Android using Expo and React Native, as explicitly selected by the user.
- Starting a journey must track the fan's actual movement through arrival, including when the phone is locked or the fan switches apps. Foreground-only tracking or a simulated journey alone does not satisfy this requirement. Background feasibility must be verified on both platforms.
- Fans can plan ahead. The user accepted Thursday 00:00 through Monday 06:00 in the race's local timezone as the reward window. Eligibility for journeys crossing the boundary and exact start-versus-arrival treatment still need an explicit rule; the latest answer specifically confirmed local timezone.
- Exact race destinations supported by next week's working demo remain undecided.

## Fan payoff described in the interview

- The store offers merchandise discounts ranging from 10% to 60%, as confirmed by the user. Larger discounts should cost substantially more points; earning should be difficult. Exact prices, earning rates, terms, and actual voucher supply remain unresolved.
- Fans can create driver/team challenges and contribute toward challenges proposed by others; the example given was a driver doing a chicken dance in Singapore before the race. Both creation and contribution are in requested first-build scope.
- Challenge funding uses earned points, not real money.
- Challenges require approval before opening for contributions. An admin or a user with the Aston Martin admin badge can approve them. The badge represents an assigned admin role; it is not a self-selected cosmetic badge. Approval interface, target-setting rules, cancellation/refunds, and fulfilment remain undefined. A fan proposal does not establish driver/team agreement to perform it.
- Challenge creation, contributions, and the store are requested for the first submission. Fulfilment versus disclosed demonstration content remains unresolved; no voucher supply or team partnership is established by the supplied material.

## Latest interview answer: 25 September 2026

- Submission is next week; exact date, required artifact, and judging requirements are not supplied.
- Multiple race locations are intended; the exact working demo catalog remains unresolved.
- Use the fan's current location as the starting point and let them select a race as the destination.
- Show multiple ways to reach the selected race, including journey time and estimated carbon emissions, and identify the lowest-carbon option among those compared.
- Google Maps API integration is intended; relevant API capabilities remain unverified.
- Lower-carbon routes should earn more points. Formula, comparability across different journeys, eligibility, and award timing remain unresolved. This may differ from the earlier emissions-reduction-based rule and needs reconciliation.
- The user explicitly deferred the carbon-baseline decision; no baseline recommendation has been accepted.
- Live tracking through arrival, including locked-phone/background operation, is required. The store, challenge creation, and points contributions are in scope; fulfilment remains open.

## Earlier direction from the supplied brief

Historical source record; the current feature boundary above takes precedence where scope differs.

- Build an Aston Martin F1 fan app that rewards sustainable actions, initially public transport journeys.
- Let fans enter a start and destination for everyday journeys within the eventual supported coverage; that coverage remains undecided.
- Compare alternative routes with prominent estimated emissions and practical information such as duration; highlight the most sustainable available option.
- Let the fan select a route, start tracking, and see a journey result with estimated emissions reduction and points.
- Base points on estimated emissions reduced. The baseline and conversion formula are unresolved.
- Demonstrate a complete loop: choose journey → compare routes and carbon impact → travel → assess journey → award points.
- Keep the initial POC focused on public transport/bus tracking. Exact supported modes remain unresolved.
- Identify simulated data and placeholder behaviour clearly.

## Proposed approaches requiring verification or agreement

- Google Maps is the preferred integration discussed; suitable capabilities, coverage, and data availability remain unverified.
- Comparing recorded route, distance, and duration with transport information is a proposed validation approach. It is not established proof of transport mode.
- The latest interview requires changed/interrupted journeys to affect displayed points. Recalculation, penalty versus provisional reduction, and insufficient-evidence handling still need precise rules.
- Harry, 37, is an illustrative fan persona, not a validated research participant.

## Technical constraints checked against official documentation

Documentation check only, 25 September 2026; no live API or device verification yet.

- [Google transit routing](https://developers.google.com/maps/documentation/routes/transit-route) supports transit journeys with walking connections and future transit searches up to 100 days ahead. Schedules may change; advance planning needs to handle unavailable future results.
- [Routes request contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes) selects one top-level travel mode. Automatically composing arbitrary taxi-plus-transit journeys is not established by the reviewed contract; treat that as distinct from comparing separate mode options.
- [Google eco-routing](https://developers.google.com/maps/documentation/routes/eco-routes) documents fuel estimates for supported motor-vehicle routes. A universal passenger carbon estimate across the requested modes is not established; the carbon methodology remains a separate open decision.
- [W3C geolocation](https://www.w3.org/TR/geolocation/#request-a-position) limits repeated updates to active, visible documents; [Chrome page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) describes suspension of frozen pages. Ordinary browser tracking cannot be relied on for uninterrupted locked-phone/background tracking. Platform choice depends on the required experience and needs physical-device validation.
- The user has selected Expo/React Native for both platforms. [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/#background-location) and [TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/) document background location support with native configuration, appropriate permissions, and a task defined outside component lifecycle. Use development builds to validate this feature; Expo Go is insufficient for the required cross-platform background behaviour. User termination and Android vendor behaviour limit continued tracking. Locked-screen arrival must be tested on physical iOS and Android devices; documentation review is not proof of device reliability.

## Other brainstormed possibilities

Fan teams, shared goals, profile rewards, exclusive content, tree planting, sustainable accommodation and food, group viewing, and energy-saving actions remain outside the initial build. Driver/team challenge creation and contributions are now in the first-build scope described above.

## Open decisions

- Delivery constraints: exact deadline next week, judging requirements, and required artifact.
- Coverage: which local race destinations must work in the first demo; race catalog and advance-planning behaviour.
- Tracking experience: background operation on both Expo/React Native platforms, permissions, location gaps, arrival detection, and app termination.
- Race-weekend eligibility: journeys crossing the agreed window's boundaries, arrival-versus-start qualification, and reward timing. Both outbound and return journeys are included.
- Carbon model: comparison baseline, calculation method, data sources, and handling of estimates.
- Points: reconcile lower absolute route emissions with the earlier emissions-reduction rule; conversion, rounding, eligibility, and accumulation rules.
- Validation: sufficient evidence, route changes, interruptions, incomplete journeys, repeated claims, and whether deductions affect provisional or already-earned points.
- Rewards: point prices for 10%–60% discounts, earning difficulty, and discount terms; admin approval interface, contribution targets/rules, cancellations/refunds, and fulfilment.
- Experience and data: identity needs, saved progress, and journey-data retention.

## Interview dependencies

1. Set delivery constraints, coverage, demonstration expectations, baseline intent, and reward expectations.
2. Verify relevant integration and emissions-data facts for the selected scope.
3. Resolve calculation, points, validation, state, and data rules against concrete journey examples.
4. Agree the demo's observable acceptance criteria and confirm shared understanding before implementation.

The supplied brief anticipates a later specification document. Incorporate it when available and reconcile conflicts explicitly. Build specifications and tickets belong in GitHub Issues under this repo's tracker convention; this local document records the ongoing planning discussion.
