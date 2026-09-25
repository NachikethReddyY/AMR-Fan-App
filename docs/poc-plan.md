# Sustainable fan travel: prototype plan

Status: revised after the user's Meeting 3 and clarity-review interview answers. Points/rewards design review is complete; calculation policy and ESG totals remain deferred; app implementation and external actions are not authorized by this task.

## Outcome and boundaries

Demonstrate ordinary sustainable travel, points, all five reward types, and team/personal ESG activity using one persistent demo profile per signed-in user, with every demo and real account starting at 0 points, alongside real-user accounts that may spend admin-granted points with demonstration fulfilment and receive no automatic starter points. Support Singapore first and use initial admin-configurable settings of 50 points/kg with a 2,000-point journey cap. Only the demo account earns simulated journey points. There is no daily trip-count limit; duplicate awards for one journey are still prohibited. Rewards has Redemption and History tabs. Journey completion is simulated. Tree redemption represents participation in an existing programme. Add a separate admin web dashboard; use the team's populated database for the fan ESG dashboard.

The [product specification](fan-app-specification.md) records the current requirements. The [meeting reconciliation](meeting-3-reconciliation.md) records source evidence and interview decisions. Earlier HTML briefs and route mockups are historical design material until reconciled.

## Ordered work packages

These define work to be done after scope and implementation authorization. Checkboxes are not claims of completed software.

| Order | Work package | Depends on | Owner recorded or needed | Completion evidence |
| --- | --- | --- | --- | --- |
| 1 | Use the confirmed points/rewards contract; schedule calculation policy and dashboard metrics for later review. | Current interview answers | Nachiketh decides product scope | Confirmed specification and open-decision disposition. |
| 2 | Define zero-start persistent demo profiles, populated catalogue/dashboard examples, consistent personal History, retained rewards/shared votes and reset records. | Confirmed interactive demo; deferred metrics | App development; data contributor not assigned | Dataset covers all approved feature states and has no real-world fulfilment claims for demo activity. |
| 3 | Select Singapore emissions data for bus, train, car, EV and cab; define units, baseline and assumptions. | Confirmed Singapore/rate/cap and start-version policy; baseline decision | AI/data team handoff to confirm | Source-backed factors and reproducible worked route calculations. |
| 4 | Agree route/AI input/output, time tolerance, error handling and fallback. | Country coverage and calculation policy | Kong plus the meeting's second AI contributor | Sample request/response and recommendation cases accepted by app and AI teams. |
| 5 | Select updated fan/admin designs using existing brand guidance. | Approved scope | App development/design | Chosen mockups cover ordinary routing, ESG, two rewards tabs and agreed admin tasks. |
| 6 | Implement route comparison and time-constrained low-emission recommendation. | Packages 3–5 | App and AI teams | Demonstrate Singapore mode candidates and missing-data behaviour. |
| 7 | Implement real accounts/shared progress, labelled journey simulation and consistent points/demo state. | Demo-only awards; calculation decisions; package 6 | App development | Complete the approved simulated flow; verify one-time credit and account separation. |
| 8 | Implement Rewards with Redemption and History and all five reward types. | Confirmed tree/challenge/reward rules and price reconfirmation; agreed points/rewards module | App development | Directly inspect both tabs and each approved reward flow; check balance/history consistency and driver-question admin review. |
| 9 | Implement fan ESG dashboard backed by the populated database. | Deferred metric definition; packages 2 and 7–8 | App development | Inspect team/personal records, years, units and demo labels against stored values. |
| 10 | Implement admin pricing/content, earning rules, reason-recorded balance adjustments, questions/challenges, ESG/factors and demo reset. | Confirmed admin controls and start-version policy | App development | Demonstrate each agreed operation; deny ordinary fans access; prove each demo reset preserves other accounts' personal state and follows the agreed shared-contribution policy. |
| 11 | Align data-processing documentation with actual demo/auth/data behaviour. | Real accounts, demo-only awards and approved integrations | Brianna/Sachita assignment from meeting to confirm | Collection, processing, retention and deletion descriptions match the implemented flow. |
| 12 | Run the complete presentation scenario and reconcile slides with built scope. | Approved packages above | App development; Dilla links to slides team | Recorded walkthrough with all simulated/prepared/live parts identified. |

## Current documentation checklist

- [x] Record demo data/account, two rewards tabs, admin web dashboard, journey simulation, programme participation, route time tolerance and populated dashboard database.
- [x] Update resolved glossary terms and retain earlier requirements with explicit precedence.
- [x] Record interactive demo plus real accounts, Singapore first, retained rate/cap, driver-question review and deferred dashboard metrics.
- [x] Record demo-only simulated earnings, all proposed admin controls, countrywide eligibility and question/content reward rules.
- [x] Record start-version calculations, independent demo progress, admin-granted real-account rewards, minimal tree participation and challenge selection/resubmission.
- [x] Record price reconfirmation and selected-challenge freezing; select points and rewards for module exploration.
- [x] Record full History, repeat purchases, shared rankings, unavailable-offer protection and append-only corrections.
- [x] Confirm zero starting points for everyone, persistent demo identity and preservation of rewards, submissions, History and shared contributions on reset; supersede starter-point restoration.
- [x] Confirm zero-balance reset, unfinished-operation handling and the selected module responsibility. Calculation policy and dashboard metrics remain user-deferred.
- [x] Update confirmed feature acceptance cases and actionable work packages; retain deferred calculation/ESG dependencies.
- [x] Verify cross-document agreement and obtain consolidated points/rewards confirmation.

## Later work and slides-only proposals

- Later implementation: actual background tracking and journey validation on physical iOS/Android devices, real reward fulfilment and actual programme allocation.
- Real-user sign-up and shared progress are in current scope. Only the demo account may earn simulated journey points. Real accounts wait for actual tracking to earn travel points; admin-granted points may be redeemed with demonstration fulfilment. There are no automatic starter points.
- Automated ESG report ingestion: possible later mechanism; the prototype dashboard uses populated records.
- Slides-only: AI sustainability ratings from photos/text/video/voice, regional campaigns and individual/regional leaderboards.
- Chatbot and voice assistant: brainstorm only.

## Selected module exploration

The user confirmed the points and rewards module. Agreed responsibility: keep authorized point changes and associated reward outcomes consistent for fan and admin callers, with tests crossing the same interface. This is design exploration, not implementation approval or a new package requirement. See [module discussion](points-rewards-design.md).

The journey-assessment implementation remains deferred. Rewards can be specified using authorized admin grants and explicit demo journey awards, with no automatic starting balance without deciding the emissions formula. A future journey award must be accepted only from trusted assessed journey state, never a client-supplied arbitrary credit.

## Existing technical direction

Retain Expo/React Native for the fan app, Convex as the backend direction, and Google Maps as the intended route integration pending verified contracts. The admin is a web dashboard; its frontend architecture has not been selected. The new admin requirement does not itself authorize a repository restructuring.

The meeting assigns Nachiketh app development and Kong plus another member the AI pipeline. Exact AI provider/model identifiers, API access, supported country datasets and operational integration remain unverified. Existing APIs are intended; custom model training is not required. No teammates have been contacted by this task.

## Earlier plan: historical record

The text below preserves the prior race-first plan and research references. The current specification and plan above override conflicts. Earlier unchecked work is not automatically in the revised prototype scope.

## Source and precedence

Based on the user's AI-extracted brief supplied on 25 September 2026, attributing the idea to meeting notes from 22 and 24 September and follow-up messages at 10:30–10:32 pm on 24 September. Original notes and messages have not been inspected.

Within the supplied meeting brief, everyday public transport journeys were central. The latest direct user clarification sets local travel to a selected race as the first feature and demo within the broader fan app. It supersedes the earlier brief for the immediate build; arbitrary everyday destinations are not required for this first feature.

## Current agreed feature boundary

- The product remains an Aston Martin F1 fan app. The first build includes race travel, creating driver/team challenges, contributing points to challenges, a rewards store, and individual tree redemptions using earned points.
- The fan is already in the race's country/location and travels from their current location to the selected race. Return travel from the race is also reward-eligible within the agreed window. Examples supplied were Singapore to a Singapore race, Malaysia to a Malaysian race, and the US to a US race.
- These examples describe the intended local-travel pattern across race locations. They do not establish a verified current race calendar or an agreed launch catalog.
- International travel to the host country is outside the described first journey.
- Compare route options by time and estimated emissions, with more points for lower-carbon travel. The agreed earning rate is 50 points per estimated kg CO₂e reduced, capped at 2,000 points per completed eligible journey; carbon-factor selection remains open.
- Baseline direction: compare with one person driving between the same start and destination. The user responded “ok?”; record this as tentatively accepted pending the final consolidated confirmation. Results are estimated differences from that scenario, not measured or causally proven emissions reductions.
- Journey points are provisional until completion. Changes reduce the current journey's estimated award rather than subtracting from previously earned points: the user accepted the illustrative 100 existing + 5 final journey points = 105 balance, replacing a 20-point initial estimate. Exact recalculation and evidence thresholds remain open.
- Transport choices include buses, MRT/rail, walking, cycling, and cabs. Public transport routes may mix modes and walking connections; a cab is a separate route, not a cab-plus-transit combination.
- Build for both iOS and Android using Expo and React Native, as explicitly selected by the user.
- Starting a journey must track the fan's actual movement through arrival, including when the phone is locked or the fan switches apps. Foreground-only tracking or a simulated journey alone does not satisfy this requirement. Background feasibility must be verified on both platforms.
- Fans can plan ahead. Rewarded journeys must both start and complete within Thursday 00:00 through Monday 06:00 in the race's local timezone. The user accepted one rewarded outbound and one rewarded return journey per race-local calendar day, each capped at 2,000 points. Further journeys can be tracked without additional automatic awards. Which day owns a journey crossing midnight remains to be specified.
- Use the F1 calendar for the race list, rather than a small admin-curated list. Calendar ingestion, arrival locations, and route-data availability need implementation verification. There is no deadline dependency.
- The user accepted selected/reported transport mode plus route, distance, and duration consistency as POC plausibility checks, acknowledging these do not prove vehicle use. Recalculate reported mode changes; insufficient tracking or non-arrival receives no automatic points, while existing earned balance is preserved.

## Points calculation

- Confirmed by the latest correction: 50 points per estimated kg reduced, with a 2,000-point cap per journey. This replaces the assistant's proposed 100 points/kg and 200-point cap.
- Proposed precise arithmetic, preserving the earlier whole-point recommendation: `min(2000, floor(50 × max(0, baseline_kgCO2e − journey_kgCO2e)))`. Apply once at qualifying completion, using the final assessed journey. Final summary will confirm rounding and the comparison baseline.
- Arithmetic examples only, not real route measurements: 1.5 kg estimated reduction gives 75 points; 10 kg gives 500; 40 kg gives 2,000; 60 kg remains capped at 2,000; zero or negative reduction gives zero.
- The cap is reached at 40 kg estimated reduction. The accepted daily limit is one rewarded outbound and one rewarded return journey per race-local day. Day attribution for overnight journeys and detailed anti-repeat checks remain to be specified.

## Fan payoff described in the interview

- The store offers merchandise discounts ranging from 10% to 60%. Admins set each reward's points price, as confirmed by the user; the earlier numeric price table is not agreed or hardcoded. Larger discounts should cost substantially more points. Discount terms and actual voucher supply remain implementation/content prerequisites; the journey earning rate is defined above.
- Fans can create driver/team challenges and contribute toward challenges proposed by others; the example given was a driver doing a chicken dance in Singapore before the race. Both creation and contribution are in requested first-build scope.
- Challenge funding uses earned points, not real money.
- Challenges require approval before opening for contributions. An admin or a user with the Aston Martin admin badge can approve them. The badge represents an assigned admin role; it is not a self-selected cosmetic badge. A fan proposal does not establish driver/team agreement to perform it.
- Challenges accumulate contributed points like votes. The top three approved challenges are selected before the drivers go on stage for the fan interaction, as confirmed by the user. This supersedes the earlier fixed-target/deadline proposal. Exact session-specific cutoff, handling of unknown/rescheduled stage times, ties, fewer than three approved challenges, and fulfilment still need definition.
- Submitting a new challenge costs 500 earned points. The fee is non-refundable, including when a submission is rejected, as explicitly clarified by the user. After approval, fans can contribute any amount of at least 10 points, limited by their available balance. Only contributed points count as votes: the 500-point submission fee does not count toward ranking.
- The user accepted clearly labelled sample vouchers and a distinct state awaiting team completion as the POC fulfilment approach. Adapt the state wording to the ranking model; do not imply an agreed funding threshold. No real voucher supply or driver/team partnership has been established.
- The latest answer establishes no challenge refunds. Approved challenges not performed remain in a backlog for later fulfilment, preserving their contributed points and history instead of returning points to fans. This supersedes the assistant's refund proposal.
- A rejected submission cannot collect contributions or become a promised performance under the agreed approval rule. Its 500-point fee is not returned. Whether the fan may edit and resubmit, and whether resubmission costs another fee, remain unresolved; the latest answer did not accept free resubmission. The fulfilment backlog covers approved unfinished challenges.

## Requested addition: tree planting and restoration

- The user requested adding the team's tree-planting idea to the core plan and checking its ESG basis. This adds to travel, challenges, and store rewards; it does not replace them.
- Verified report basis: the [2024 Make A Mark report, pp. 35–36](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=35) reports 1,500 trees planted at the AMR Technology Campus. The [2025 report, p. 26](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=26) describes community woodland/agroforestry in the North Ethiopian Highlands and mangrove restoration at Mtwapa Creek, Kenya. These are reported facts, not independent project verification.
- The [2025 report, p. 91, footnote 3](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=91) identifies Climate Impact Partners as the purchase/quality-assurance channel. Its 2,124 tCO₂e total includes concrete mineralisation as well as nature-based projects; it is not a tree-only total or an app impact figure. See [research note](research/tree-planting-esg.md) for scope and limits.
- Fans choose to redeem individual trees using earned points. An admin sets the points price per tree; the price is displayed before redemption. This supersedes the earlier proposal of open-ended project contributions with a 10-point minimum. Journeys do not automatically spend the fan's points.
- Each redeemed tree is assigned to the purchasing account and uses that account's name, as confirmed by the user; no separately entered dedication name is required. An optional quote remains a proposed addition from the earlier answer, not a settled requirement. Visibility and name-change handling remain to be confirmed in the final defaults.
- If the original planting project/country cannot fulfil the request, redirect the pending planting request to another country, as requested by the user. This describes reassignment of an unfulfilled planting request, not physical relocation of an already-planted tree. The user-notification/choice policy, equivalent-cost handling, and fallback if no project is available remain open.
- Any POC participation is disclosed as demonstration content until a partner, actual funding, conversion rule, and fulfilment evidence are arranged. Points committed, planting/restoration funded, trees planted, and verified carbon removal are different quantities.
- Keep estimated travel emissions differences separate from any project impact. Do not convert a count of trees into immediate carbon savings or claim the app's participation is covered by an existing team partnership.

## Accounts and data

- The user accepted email-based accounts, progress shared across devices, private detailed location traces retained for seven days, and longer-lived journey summaries/emissions/points transactions.
- Convex is the requested backend direction. Official documentation supports React Native clients, authenticated functions, transactional balance updates, and scheduled deletion. A compatible sign-in option still needs selection; Convex Auth is documented as beta. This is a capability check, not an implementation or deployment.
- Admin status is assigned and enforced as authorization; it is not a self-selected cosmetic badge.

## Business model discussion — proposals, not agreements

- The user asked how the app makes money for Aston Martin. Earned points and challenge contributions are not themselves cash revenue.
- Candidate sources are sponsorship of fan activities/rewards and additional merchandise sales attributable to engagement and redemption. Profitability requires incremental margin and sponsor income to exceed reward and operating costs; no commercial results or partner commitments are established.
- Large discounts, including the requested 60% tier, may need a sponsor subsidy or restricted eligible stock to preserve margin. Restrictions and funding remain product/commercial proposals, not changes to the agreed store.
- Context: the team's [I / AM membership](https://www.astonmartinf1.com/en-GB/IAM) is already free to join and advertises fan experiences and a first-order merchandise discount. The proposed app should have a clear incremental role. The [partner programme](https://www.astonmartinf1.com/en-GB/partners) establishes that partnerships exist, not that any partner will fund this app.

## Latest interview answer: 25 September 2026

- The user explicitly does not want to share or discuss the deadline and requests the core local build without publishing. Deadline and submission format are not prerequisites for local work.
- Race selection should follow the F1 calendar.
- Use the fan's current location as the starting point and let them select a race as the destination.
- Show multiple ways to reach the selected race, including journey time and estimated carbon emissions, and identify the lowest-carbon option among those compared.
- Google Maps API integration is intended; relevant API capabilities remain unverified.
- Lower-carbon travel earns 50 points per estimated kg reduced, capped at 2,000 per qualifying completed journey. Carbon dataset and whole-point/baseline confirmation remain open.
- The previously deferred carbon baseline was revisited: comparison with one-person driving is tentatively accepted, subject to final confirmation.
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
- Comparing reported transport mode and recorded route, distance, and duration is accepted for POC plausibility checking. It is not established proof of transport mode.
- Changed/interrupted journeys affect provisional journey points; previously earned balance remains intact. Recalculation and insufficient-evidence handling still need precise rules.
- Harry, 37, is an illustrative fan persona, not a validated research participant.

## Technical constraints checked against official documentation

Documentation check only, 25 September 2026; no live API or device verification yet.

- [Google transit routing](https://developers.google.com/maps/documentation/routes/transit-route) supports transit journeys with walking connections and future transit searches up to 100 days ahead. Schedules may change; advance planning needs to handle unavailable future results.
- [Routes request contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes) selects one top-level travel mode. Automatically composing arbitrary taxi-plus-transit journeys is not established by the reviewed contract; treat that as distinct from comparing separate mode options.
- [Google eco-routing](https://developers.google.com/maps/documentation/routes/eco-routes) documents fuel estimates for supported motor-vehicle routes. A universal passenger carbon estimate across the requested modes is not established; the carbon methodology remains a separate open decision.
- [W3C geolocation](https://www.w3.org/TR/geolocation/#request-a-position) limits repeated updates to active, visible documents; [Chrome page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) describes suspension of frozen pages. Ordinary browser tracking cannot be relied on for uninterrupted locked-phone/background tracking. Platform choice depends on the required experience and needs physical-device validation.
- The user has selected Expo/React Native for both platforms. [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/#background-location) and [TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/) document background location support with native configuration, appropriate permissions, and a task defined outside component lifecycle. Use development builds to validate this feature; Expo Go is insufficient for the required cross-platform background behaviour. User termination and Android vendor behaviour limit continued tracking. Locked-screen arrival must be tested on physical iOS and Android devices; documentation review is not proof of device reliability.
- Carbon methodology check: summing each leg's distance times a consistent per-passenger emissions factor is a viable estimation approach. The [UK 2025 conversion methodology](https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf) distinguishes passenger-km from vehicle-km, CO₂ from total CO₂e, and operational from upstream emissions. It is a methodology reference, not a selected factor dataset. A bounded read of the [NEA inventory](https://www.nea.gov.sg/docs/default-source/cmd-documents/ghg-documents/nid-2024.pdf) and [LTA sustainability report](https://www.lta.gov.sg/content/dam/ltagov/who_we_are/statistics_and_publications/report/pdf/LTA_SR2425.pdf) did not establish a complete comparable Singapore mode-factor set. Country-specific factors and any disclosed proxy must still be selected and validated; comparison with a hypothetical car trip does not prove caused emissions reductions.
- Convex: [React Native client](https://docs.convex.dev/client/react-native), [authentication and authorization](https://docs.convex.dev/auth/overview), [transactional mutations](https://docs.convex.dev/functions/mutation-functions), and [scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions) support the planned backend. Private record access, assigned admin roles, available-balance checks, and duplicate-credit protection remain application rules. Schedule cleanup using record IDs, not raw coordinates in job arguments; deletion from all backups/logs/mobile caches is not established by this documentation check.
- Calendar source: the [official F1 calendar](https://www.formula1.com/en/racing/2026) is the primary source for current event entries. Calendar presence is separate from verified entrance coordinates, transport coverage, or fan-stage schedules.

## Other brainstormed possibilities

Fan teams, shared goals, profile rewards, exclusive content, sustainable accommodation and food, group viewing, and energy-saving actions remain outside the initial build. Driver/team challenge creation and contributions are in scope, alongside optional individual tree redemptions with admin-set point prices.

## Open decisions

- Local delivery is settled: source and local development builds only; no publication or deadline dependency.
- Coverage: F1 calendar is selected; calendar ingestion, arrival locations, missing route data, and advance-planning behaviour require precise handling.
- Tracking experience: background operation on both Expo/React Native platforms, permissions, location gaps, arrival detection, and app termination.
- Race-weekend eligibility: both start and completion must be inside the agreed window. One outbound and one return may be rewarded per race-local day. Specify overnight day attribution and technical boundary inclusivity.
- Carbon model: comparison baseline, calculation method, data sources, and handling of estimates.
- Points: 50 points/kg estimated reduction, the 2,000-point cap, and the daily rewarded-journey count are settled; confirm whole-point rounding in the final summary.
- Validation: evidence thresholds, arrival detection, interruptions, and repeated claims; deductions reduce provisional journey awards.
- Rewards: admins set store point prices; no challenge refunds and approved backlog carry-over are settled. Rejected submissions keep the non-refundable fee and cannot receive contributions. Resolve editing/resubmission rules, then confirm voting cutoff/tie handling and sample fulfilment defaults. Submission fee exclusion from ranking is settled.
- Backend: select compatible authentication for Convex. Shared progress and seven-day private trace retention are accepted.
- Business model: decide whether sponsorship and incremental merchandise sales are the intended revenue hypothesis; real unit economics and partnerships remain unvalidated.
- Trees: admin-set price and assignment to the purchasing account/name are settled. Confirm optional-quote scope, privacy and reassignment defaults. Partner funding and real fulfilment are not established by the POC.

## Acceptance scenarios for the agreed rules

These are specification examples, not executed app tests.

| Scenario | Expected behaviour |
| --- | --- |
| Eligible journey has a final estimated reduction of 10 kg CO₂e | Credit 500 points once after completion. |
| Eligible journey has a final estimated reduction of 60 kg CO₂e | Credit the 2,000-point maximum once. |
| A fan has 100 earned points; an unfinished journey changes from 20 estimated points to 5 | Show the revised estimate; on qualifying completion the balance is 105. |
| Journey starts before Thursday 00:00 or finishes after the Monday cutoff in race-local time | Track/display the journey, but award no race-window points. Exact cutoff inclusivity will be confirmed in final defaults. |
| Tracking is insufficient or no arrival is recorded | Award no automatic journey points; preserve the previous earned balance. |
| Fan completes a second outbound journey on the same race-local day | Track/display it, but award no further outbound points for that day; the one return allowance remains separate. Overnight day attribution is still open. |
| Fan has 600 points and submits a challenge | Deduct 500; leave 100 available; keep ranking contribution at zero until someone contributes. |
| Admin rejects that submitted challenge | Keep the balance at 100; return none of the 500-point fee; do not enable contributions or promise performance. Editing/resubmission policy remains open. |
| Fan contributes 10 points to an approved challenge | Deduct 10 from available balance and add 10 to that challenge's rank total, once. |
| Fan tries to contribute to an unapproved challenge or spend more points than available | Refuse the operation without changing balances or rankings. |
| Admin closes selection before a fan-stage appearance | Select the top three approved challenges by contributed points; fulfilment is tracked separately. |
| Approved challenge is not selected/performed | Keep it in the backlog with its point total; issue no refund. |
| Admin offers a tree for 300 points; fan redeems one with 500 available | Deduct 300; create one tree record assigned to that account and name; leave 200 points. The price is illustrative admin input. |
| Original country cannot fulfil a pending tree request | Reassign the planting request to another country and retain its account assignment; do not label it planted without fulfilment evidence. |
| Admin changes a discount reward's point price | Subsequent redemptions use the displayed current price; preserve earlier transaction history. |

## Interview dependencies

1. Resolve carbon comparison intent, acceptable journey evidence, reward-window handling, challenge selection/refunds, supported race catalog, and account/data expectations.
2. Verify facts needed for the selected carbon approach; then agree points conversion and store prices using concrete journey examples.
3. Resolve only the dependent exceptions exposed by those answers and write observable acceptance criteria.
4. Present one consolidated summary and obtain explicit confirmation of shared understanding. This completes grill-with-docs.

Screen direction selection belongs to the later UI phase and is not a condition for finishing this interview. Earlier mockups contain illustrative values, not accepted earning rates or emissions factors.

The supplied brief anticipates a later specification document. Incorporate it when available and reconcile conflicts explicitly. Build specifications and tickets belong in GitHub Issues under this repo's tracker convention; this local document records the ongoing planning discussion.
