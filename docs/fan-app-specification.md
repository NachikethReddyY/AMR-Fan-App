# Aston Martin fan app: product specification

Status: core product choices confirmed through the technical-draft interview. Detailed requirements and acceptance cases now live in the [feature specification](features/README.md). The committed app is an Expo starter. Separate local changes add Home and navigation tabs; they are outside this documentation commit. Planned travel, rewards, impact and admin behavior is not implemented.

## Product idea

Help Aston Martin fans use an iOS/Android phone app for sustainable travel, rewards and sourced team ESG information. Fans choose ordinary starting points and destinations; a race is one possible destination. The POC checks real journeys using location and includes a separate labelled demo profile. Admins use a separate web app.

Sources: `meet 3.pdf`, especially pp. 9 and 13–15, the supplied technical draft, and the user's meeting, clarity-review and technical-draft interview answers. See [meeting source comparison](meeting-3-reconciliation.md) and [technical-draft decisions](technical-spec-reconciliation.md). Latest direct user decisions override earlier requirements and draft recommendations.

## Confirmed experience and feature inventory

The [12-feature index](features/README.md#features) lists the scope, rule owners and links. Each feature has accepted behavior, dependencies, remaining implementation work and acceptance cases.

## Journey and emissions requirements

Owned by [route planning](features/02-route-planning.md), [emissions estimates](features/03-emissions-estimates.md) and [real journey tracking](features/04-journey-tracking.md). The accepted product uses ordinary Singapore travel, real location evidence, a single-driver comparison and the fan's extra-time limit measured from the fastest available route.

## Accounts and interactive state

Owned by [accounts and demo mode](features/01-accounts-and-demo.md), including zero starting balances, persistent demo identity, shared voting and reset protections.

## Points rules

Owned by [points, Rewards and History](features/05-points-and-history.md), including the existing rate/cap, bounded missing-GPS awards and difference-only top-ups when later evidence supports a higher total.

## Rewards requirements

Shared spending and History rules belong to the points feature. Individual behavior belongs to [fan submissions](features/06-fan-submissions.md), [tree dedications](features/07-tree-dedications.md), [exclusive content](features/08-exclusive-content.md) and [merchandise discounts](features/09-merchandise-discounts.md). Questions and proposed activities are one submission feature with optional content tags.

## Dashboards and populated data

Owned by [impact](features/10-impact-dashboard.md), [report upload and review](features/11-report-ingestion.md) and [admin operations](features/12-admin-dashboard.md). Impact shows personal and community lifetime travel estimates alongside separately sourced official team figures. Report extraction fills supported details for admin review before approval.

## Acceptance examples for confirmed decisions

The [feature documents](features/README.md) own all acceptance cases. The previous active specification's 69 examples were moved to their owning features, with the old unresolved late-evidence example updated to the approved top-up. Added cases cover the new baseline, time limit, lifetime totals and reward protections. None is an executed app test.

## Confirmed calculation decisions

The user approved all four final proposals: one person driving between the same places as the baseline; extra minutes relative to the fastest route; only the difference added after stronger GPS evidence; and personal/community lifetime savings with official figures separate. Exact datasets, compatible units, rounding and evidence thresholds remain implementation work listed with the owning features.

## Confirmed architecture and remaining work

Retain Expo/React Native for fans, a separate admin web app and Azure for the backend. Azure services, authentication and final screen designs are not selected by this feature split. The [architecture status](internals/architecture.md) records what runs today; the [points/rewards module design](points-rewards-design.md) records the agreed shared implementation responsibility.

The [feature index](features/README.md#remaining-implementation-work) owns the remaining implementation checklist. Actual reward fulfilment is later work. AI action evidence scoring, campaigns, leaderboards and chatbot/voice features remain proposals. The [POC plan](poc-plan.md) records handoffs and sequencing. The user authorized [linked implementation issues](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3); this task leaves application implementation and deployment for subsequent work.

## Earlier specification: historical record

Everything below records the previous race-first specification. It preserves provenance and unresolved rules; where it conflicts with the revised requirements above, the revised requirements take precedence. It is not an additional prototype checklist.

## Problem Statement

> [!IMPORTANT]
> **Specification only — do not build yet.** This document records future product requirements and the approved testing approach. The user explicitly instructed that no app work be built at this stage. Wait for a separate instruction to begin building. Implementation work belongs in separately scoped issues.

An Aston Martin F1 fan travelling locally to a race needs to compare practical transport options, understand their estimated carbon impact, and receive meaningful recognition for choosing lower-emission travel. Today, the proposed experience has no single flow connecting race selection, route comparison, actual journey tracking, a trustworthy points balance, and participation with the team.

The fan also needs a reason to return to the wider fan app: proposing or supporting driver/team challenges, earning merchandise discounts, and supporting individual tree-planting requests. Those benefits must distinguish points spent from real-world fulfilment so that a demo never looks like an established voucher, driver, or planting commitment.

This specification describes future product workflows. The repository now contains an Expo/React Native starter, planning documents and static screen-direction mockups; the starter does not implement these product workflows. The intended audience in this earlier scope includes fans and assigned Aston Martin admins.

## Solution

Build an Expo/React Native fan app for iOS and Android, with the backend on Azure and Google Maps as the intended routing integration. The first feature is local travel from the fan's current location to a race selected from the F1 calendar, including return travel from that race.

The core experience is:

**Select race → compare route options, duration, estimated emissions and provisional points → choose a route → track actual travel through arrival → validate the journey and eligibility → credit points once → spend points on challenges, merchandise discounts or individual tree requests.**

For an eligible completed race journey, earn **50 points per estimated kg CO₂e reduced**, capped at **2,000 points per journey**. The race weekend runs from **Thursday 00:00 to Monday 06:00 in the race's local timezone**; both start and completion must be within the window. The daily journey allowance is **one rewarded outbound and one rewarded return journey per race-local calendar day**.

Challenge submission costs **500 non-refundable points**, including if rejected; this fee never counts toward ranking. Approved challenges accept contributions of **at least 10 points**. Contributions determine the **top three** selected before the drivers' fan-interaction stage appearance. Approved unfinished challenges retain their points in the backlog without refunds.

The rewards store offers **10%–60% merchandise discounts** at admin-set points prices. Individual tree redemptions also have an admin-set points price and are assigned to the purchasing account and that account's name.

> [!IMPORTANT]
> Confirmed rules are requirements. Proposals and unresolved choices remain explicitly marked below. Recording an open choice in this specification does not approve it. Once implementation is separately authorized, an agent must resolve an affected material decision before implementing dependent behavior, while continuing work that is already defined.

## User Stories

### Account, access and continuity

1. As a fan, I want to use the app on iOS or Android, so that I can participate using my own phone.
2. As a fan, I want an email-based account, so that my points and activity belong to me.
3. As a fan, I want my progress available across devices, so that changing phones does not create a separate balance or lose my activity.
4. As a fan, I want my detailed location traces to remain private, so that other users cannot follow my movements.
5. As a fan, I want detailed location traces retained for seven days while journey summaries and points history remain available longer, so that I can review my progress without indefinite retention of raw movements.
6. As an Aston Martin admin, I want my assigned role enforced by the backend, so that fans cannot grant themselves moderation or pricing powers by changing a badge.

### Race planning and route comparison

7. As a fan, I want to select a race from the F1 calendar, so that I can plan travel to an actual event.
8. As a fan already in a race's host location, I want to start planning from my current location, so that I do not have to reconstruct where I am before comparing routes.
9. As a fan, I want the selected race to supply an appropriate arrival location, so that the route takes me to a usable race destination.
10. As a fan, I want to plan before the race weekend, so that I can compare travel options in advance.
11. As a fan, I want planning and reward eligibility distinguished, so that planning a trip early does not imply that travelling outside the window earns points.
12. As a fan, I want to compare available public transport routes containing buses, MRT/rail and walking connections, so that I can choose a practical multimodal journey.
13. As a fan, I want to compare walking and cycling options where supported, so that active travel is included in my choices.
14. As a fan, I want a separate cab route option, so that I can compare a direct vehicle journey with the other available options.
15. As a fan, I want estimated emissions displayed prominently alongside journey duration, so that the environmental and practical trade-offs are understandable before I choose.
16. As a fan, I want the lowest-emission option among those compared highlighted, so that I can identify it without manually comparing every number.
17. As a fan, I want to see provisional journey points for each option, so that I understand the potential reward before travelling.
18. As a fan, I want to choose my own route, so that I can balance journey time, convenience and estimated emissions.
19. As a fan, I want unavailable routes or future schedules identified honestly, so that I am not shown invented transport options as live results.
20. As a fan, I want to plan return travel from the race, so that the same feature also supports my journey back.

### Actual travel and journey validation

21. As a fan, I want Start journey to track my actual movement, so that my completed trip can be assessed.
22. As a fan, I want tracking to continue when I lock my phone or use another app, so that I do not need to keep the fan app visible throughout the journey.
23. As a fan, I want arrival recorded before the journey is assessed for points, so that starting a trip alone cannot be mistaken for completing it.
24. As a fan, I want the route, distance and duration compared with my reported transport mode, so that journey validation uses plausible evidence.
25. As a fan, I want to understand that these checks do not prove the vehicle I used, so that the app does not overstate its validation capability.
26. As a fan, I want changes to my reported mode or assessed journey reflected in the provisional award, so that the eventual result reflects the journey assessed at completion.
27. As a fan, I want missing tracking evidence or non-arrival to prevent an automatic award, so that incomplete evidence does not become a false completion.
28. As a fan, I want a changed journey estimate to leave my previously earned points intact, so that reassessment of a current journey is not an unrelated balance penalty.
29. As a fan, I want to see my final estimated emissions reduction and points after completing an eligible journey, so that I understand the result.

### Eligibility and the points balance

30. As a fan, I want eligibility calculated using the race's local timezone, so that the race weekend is consistent for everyone attending that event.
31. As a fan, I want a journey rewarded only when both its start and completion fall within the agreed race weekend, so that the earning rule is predictable.
32. As a fan, I want one outbound and one return journey rewarded per race-local day, so that both directions of attendance are recognised within the daily allowance.
33. As a fan, I want additional journeys to remain trackable without extra automatic awards, so that reaching the daily allowance does not disable journey recording.
34. As a fan, I want to earn 50 points per estimated kg CO₂e reduced on eligible completed travel, so that lower-carbon choices have a defined reward rate.
35. As a fan, I want each journey's award capped at 2,000 points, so that unusually long trips follow the same published limit.
36. As a fan, I want provisional journey points kept separate from my available earned balance, so that I cannot spend a reward before it is earned.
37. As a fan, I want a completed journey credited only once despite retries or another device reconnecting, so that my balance remains accurate.
38. As a fan, I want spending refused when my balance is insufficient, so that my balance cannot become negative.
39. As a fan, I want each successful spend reflected once in my balance and the related reward or challenge, so that retries or simultaneous actions cannot charge me twice or create inconsistent results.

### Driver and team challenges

40. As a fan, I want to submit a new driver/team challenge for 500 points, so that I can propose an activity I would like to see.
41. As a fan, I want the non-refundable fee made clear before submission, so that I understand I will not get those 500 points back if the idea is rejected.
42. As a fan, I want submission to enter an approval stage, so that only approved ideas can receive contributions.
43. As an Aston Martin admin, I want to approve or reject submitted challenges, so that I can moderate the activities proposed for drivers and the team.
44. As a fan, I want rejected challenges to remain closed to contributions, so that rejection is not mistaken for an approved future performance.
45. As a fan, I want to contribute any amount of at least 10 points up to my available balance to an approved challenge, so that I can support the ideas I care about.
46. As a fan, I want my contribution deducted from my points balance, so that challenge support represents an actual spend of earned points.
47. As a fan, I want contributed points to increase the challenge's ranking total, so that support influences which challenges are selected.
48. As a fan, I want the 500-point submission fee excluded from ranking, so that only contributions act as votes.
49. As an Aston Martin admin, I want the top three approved challenges selected by contributed points before the drivers' fan-interaction appearance, so that the selection reflects fan support before the session begins.
50. As a fan, I want approval, selection and performance shown as different states, so that a selected idea is not displayed as already performed.
51. As a fan, I want approved unfinished or unselected challenges retained in the backlog with their contributions and history, so that their support is preserved for later fulfilment.
52. As a fan, I want the no-refund rule clear for challenge contributions, so that I understand that a backlog entry does not return my points.
53. As a fan viewing the POC, I want sample driver/team fulfilment clearly identified, so that I do not mistake it for a confirmed real-world commitment.

### Rewards store

54. As a fan, I want to redeem accumulated points for merchandise discounts between 10% and 60%, so that sustainable travel can contribute toward a fan benefit.
55. As an Aston Martin admin, I want to set the points price of each store reward, so that the team can manage how hard it is to earn.
56. As a fan, I want higher-value discounts to require substantially more points, so that the reward progression reflects the intended difficulty.
57. As a fan, I want to see a reward's points cost and offer terms before redemption, so that I can make an informed choice.
58. As a fan, I want a successful redemption to deduct the displayed cost and create the corresponding redemption once, so that my balance and reward agree.
59. As a fan, I want earlier redemptions and their costs preserved when an admin changes a reward's price, so that historical transactions remain accurate.
60. As a fan viewing the POC, I want sample vouchers labelled as demonstrations, so that I do not mistake them for supplied merchant offers.

### Individual tree requests

61. As a fan, I want to choose to buy an individual tree with earned points, so that supporting a planting request is my decision rather than an automatic spend after travel.
62. As an Aston Martin admin, I want to set the points price per tree, so that the current redemption cost is controlled by the team.
63. As a fan, I want to see the per-tree points price before redemption, so that I understand how much of my balance will be spent.
64. As a fan, I want every redeemed tree assigned to my account and my account's name, so that my tree requests are associated with me.
65. As a fan, I want the points debit and individual tree record created together, so that I am not charged without a corresponding request.
66. As a fan, I want an unfulfilled planting request redirected to another country when its original project cannot deliver, so that the request can still be fulfilled without losing its account association.
67. As a fan, I want redemption, pending planting and confirmed planting distinguished, so that spending points is not presented as proof that a tree already exists.
68. As a fan viewing the POC, I want the tree feature labelled as a demonstration until partner funding and fulfilment evidence are arranged, so that I understand its current limits.
69. As a fan, I want tree activity kept separate from estimated travel emissions, so that a tree request is not represented as immediate carbon removal or a verified offset.

## Implementation Decisions

### Scope and platform

- The current first-build scope includes race journeys, points, challenge creation and contributions, the rewards store, and individual tree redemptions within the wider Aston Martin fan app.
- Race-focused local travel supersedes the earlier everyday-destination POC for this build. The fan is already in the host location. The same pattern is intended across supported race locations, beginning with a Singapore-oriented demonstration; country examples do not assert calendar entries or complete regional coverage.
- Use Expo and React Native for both iOS and Android. Google Maps is the intended route provider. The backend will run on Azure; its services and authentication provider are not yet selected. Email-based accounts and progress shared across devices are agreed.
- Use the F1 calendar for event selection. Event calendar entries, usable race destinations, race-local timezones and fan-interaction session times are separate data needs. Calendar ingestion and supported locations still require verification.
- Preserve the distinction between required live travel behavior and disclosed demo fulfilment. Mock location replay can support automated checks but cannot replace actual tracking for acceptance. Sample vouchers, driver activities and tree fulfilment must be labelled.
- There is no selected final UI direction yet. The existing static screen directions are proposals, and their illustrative numbers do not override the confirmed rules.

### Journey planning, tracking and assessment

- Route options expose practical duration, estimated emissions and provisional journey points. Highlight the lowest estimated emissions among the options actually available; do not claim a globally optimal route across unavailable modes or data.
- Transit alternatives may contain bus, MRT/rail and walking legs. Walking, cycling and a cab route are separate comparable options where available. Arbitrary cab-plus-transit composition is not an agreed requirement.
- Record actual travel from Start journey until arrival, including app backgrounding and locked-phone operation. Configure native background location and permissions. Device/platform restrictions must be handled honestly; indefinite tracking after user termination is not assumed.
- Journey validation assesses selected/reported transport mode against recorded route, distance and duration. These checks indicate plausibility and do not prove the transport mode used.
- Recalculate provisional journey points when the reported mode or assessed route changes. Do not implement an automatic route-deviation penalty against the earned balance. Insufficient evidence or non-arrival receives no automatic award.
- Both start and completion must be inside Thursday 00:00 to Monday 06:00 in the race's local timezone. One rewarded outbound and one rewarded return are allowed per race-local calendar day. Further travel remains trackable without extra automatic awards.
- Exact cutoff inclusivity, overnight day attribution, return destination selection, arrival thresholds, tracking gaps and repeat-claim detection require the decisions listed in Further Notes.

### Emissions and points

- The earning rate is 50 points per estimated kg CO₂e reduced, with a 2,000-point cap for each eligible completed journey. The cap is reached at an estimated reduction of 40 kg. Arithmetic examples are not evidence of typical local journey earnings.
- A journey's estimate does not enter the spendable balance until qualifying completion. A fan with 100 earned points whose current estimate changes from 20 to 5 has 105 after qualifying completion, not a deduction from the original 100.
- Final credit must be idempotent. Completion retries, reconnection and concurrent devices must not duplicate credit or bypass the daily allowance.
- Earned points are spent for challenge submission, contributions and redemptions. Backend-authorized atomic operations must reject insufficient balances without partially changing either the balance or the associated record.
- Preserve a points transaction history and the result of each completed operation so that balances, rankings, redemptions and historical prices remain consistent. This is a behavior and persistence requirement, not a prescribed internal table or file layout.

> [!NOTE]
> **Calculation proposal, not a final decision:** compare the final assessed journey with one person driving the same endpoints; clamp a non-positive estimated difference to zero, multiply a positive difference by 50, round down to whole points and cap at 2,000. The baseline, rounding, factor dataset, occupancy assumptions and emissions boundary still require agreement. Estimate route emissions by summing compatible leg-distance × mode-factor values only after that method is confirmed. Do not present estimated differences as measured or causally verified carbon savings.

### Challenges, approval and selection

- A new fan challenge costs 500 earned points at submission. This is non-refundable even after rejection. The fee never contributes to the challenge's ranking.
- An assigned Aston Martin admin must approve a challenge before contributions open. The admin badge indicates authorization and is not a self-selected cosmetic fan reward.
- Contributions must be at least 10 points and cannot exceed the contributor's available balance. Deduct points and increase the approved challenge's contribution total atomically, once per successful operation. Contributions use earned points, not cash.
- Rank approved challenges by contributed points. Select the top three before the relevant fan-interaction session. This replaces the earlier fixed-funding-target idea.
- Approval, selection and performance are separate outcomes. An approved challenge not selected or performed remains in the challenge backlog, retaining contributions and history for later fulfilment. There are no challenge refunds.
- Rejected challenges cannot receive contributions or become a promised performance. The non-refundable fee rule does not decide whether editing/resubmission is allowed or whether a second fee would apply.
- Cutoff timestamps, ties, zero-contribution entries, fewer than three eligible entries, postponed sessions and later backlog selection remain open. Do not silently invent those policies.

### Rewards store and individual trees

- The rewards store offers merchandise discounts from 10% to 60%. Admins set points prices; larger discounts should cost substantially more points. No fixed numeric pricing table has been approved.
- Show a reward's price and terms before redemption. A successful operation uses its applicable price and preserves the price in transaction history. If a price changes while a fan is deciding, do not silently charge more than the price the fan accepted; the exact refresh/confirmation interaction can be designed later.
- Discount fulfilment is represented with labelled sample vouchers in the POC. Real stock, merchant supply, offer restrictions and funding are not established.
- A tree redemption buys an individual planting request at an admin-set points price. It is an optional fan spend, not automatic allocation of journey points or an open-ended challenge-style contribution.
- Each redeemed tree belongs to the purchasing account and uses the account's name. There is no required separately entered dedication name. Optional quotes remain undecided.
- Planting reassignment redirects an unfulfilled request to another country when the original project cannot deliver. Preserve its account association and distinguish it from moving an already-planted tree.
- Redemption and pending status are separate from confirmed planting. Real planting requires partner funding and evidence. Demonstration progress must never be presented as verified planting or immediate carbon removal.
- Tree visibility, account-name changes, country-change notification/choice, cost differences and the no-alternative outcome remain open. Challenge no-refund rules do not define the policy for failed tree fulfilment.

### Data, authorization and module responsibilities

- The model needs to represent accounts and assigned roles; races and destinations; planned and recorded race journeys; provisional and final assessments; race-local earning allowances; point transactions; fan challenges and contributions; fan-interaction selections and performance state; admin-priced offers and redemptions; individual tree requests and planting reassignment.
- Keep detailed GPS traces private and retain them for seven days. Keep summaries, emissions results and points transactions longer. A cleanup schedule must be tested; the policy for backups, logs, caches and the retention start event still needs definition.
- Derive account identity and admin authorization from authenticated backend context. A client-supplied account identifier, badge or balance cannot grant access or authorize a spend. Server operations enforce ownership, role, available balance and one-time effects.
- Keep the points balance and related operation updates within a transactional boundary. Concurrent reward completions and spending must preserve the same invariants as sequential actions.
- Conceptual responsibilities are race/route planning, journey tracking and assessment, the points balance, fan challenges, the rewards store, tree requests, and account/admin access. These describe the behavior being built; a separate service or package for each is not required. Keep related backend behavior together and avoid unnecessary infrastructure.

## Testing Decisions

### Agreed testing boundary

**Confirmed by the user:** use one authenticated application boundary with controlled time, Maps responses and location samples, plus real background-tracking and arrival checks on physical iOS and Android devices. These tests describe future implementation work; creating this specification does not authorize building or scaffolding the app.

- Prefer **one primary automated boundary: authenticated backend operations and the results observable to fans/admins**. Drive journey assessment and completion, point credit/spending, challenges, redemptions and subsequent reads through that public application boundary. Assert visible state, returned outcomes, balances and permissions rather than internal helpers, table layouts, call counts or private implementation details.
- Provide controlled time, route-provider responses and location samples where external systems enter the application. They are inputs to the same workflow tests, not a separate test suite for every internal module. Use them to exercise deterministic business behavior, timezones, retries, failures and concurrent operations.
- Keep **physical-device verification as complementary acceptance evidence**. API tests cannot prove that Expo keeps recording while the screen is locked. On iOS and Android development builds, perform real travel and arrival checks with permissions, app switching, locking, interruption and termination behavior documented.
- Use UI checks for the essential visible loop: route comparison, prominent emissions and time, provisional versus available points, final results, submission fee disclosure, sample fulfilment labels and admin controls. Do not substitute type checking for the requested user experience.
- Existing test prior art: none found in this repository. The current artifacts are planning and static mockups, not executable application tests. No test framework or pre-existing test seam is selected by this spec.

### Observable acceptance scenarios

The following are specifications for later tests, not results from an implemented app. Emissions quantities and admin prices below are controlled examples.

| Scenario | Expected external behavior |
| --- | --- |
| Compare available routes to a selected race | Show mode/legs, duration, estimated emissions and provisional points; identify the lowest estimate among returned options. |
| A route provider has no valid result or future schedule | Report unavailable data; do not fabricate a live route or silently substitute an undisclosed fixture. |
| Track a real journey with the phone locked, then arrive | Actual movement and arrival remain available for assessment on each supported device; a replay is not evidence of success. |
| Final assessed reduction is 1.5 kg CO₂e on an eligible journey | Credit 75 points once. |
| Final assessed reduction is 10 kg CO₂e on an eligible journey | Credit 500 points once. |
| Final assessed reduction is 40 or 60 kg CO₂e on an eligible journey | Credit 2,000 points once. |
| Available balance is 100 and current estimate changes from 20 to 5 | Keep 100 spendable during travel and show the revised estimate; after qualifying completion show 105. |
| Journey starts before Thursday 00:00 or completes after Monday 06:00 in race-local time | Record/display the journey without a race-window award. Exact boundary-equality cases await the pending policy. |
| Fan/device timezone differs from race timezone | Apply the race timezone consistently to the reward window and daily allowance. |
| The first rewarded outbound and first rewarded return both occur on the same local day | Assess each independently, each with a maximum award of 2,000 points. |
| A second outbound or second return occurs after that direction's allowance was consumed | Keep the journey trackable; grant no additional automatic award for that direction/day. |
| Two same-day completions compete for one remaining direction allowance | Credit at most one; do not exceed the allowance through concurrent requests. |
| Completion is retried or repeated from another device | Return consistent recorded results; do not duplicate the journey credit. |
| Tracking is insufficient or arrival is absent | Grant no automatic points and preserve previously earned points. |
| Fan attempts to spend provisional points | Only the available earned balance can fund the operation. |
| Fan with 600 points submits a challenge | Deduct 500 once, leave 100, enter approval state and leave ranking at zero. |
| Admin rejects that challenge | Leave the balance at 100, return none of the 500 points, keep contributions closed and do not promise performance. |
| A valid new challenge submission is retried | Do not duplicate the debit or create unintended duplicate challenges for the same operation. |
| Fan contributes 10 to an approved challenge | Deduct 10 and increase its ranking by 10 together, once. |
| Fan contributes less than 10, more than the available balance, or to an unapproved/rejected challenge | Refuse without changing balance or ranking. |
| Two simultaneous spends exceed the combined available balance | Reject the operation that cannot be funded; never produce a negative balance or a partial related record. |
| Four approved challenges have distinct contribution totals before a configured stage selection | Select the three with the highest contributed totals; submission fees do not affect ordering. |
| An approved challenge is not selected or not yet performed | Preserve it and its contributed points/history in the backlog without refunds; do not mark it performed. |
| A fan attempts an admin-only operation by supplying an admin badge or another identity | Refuse unauthorized approval, pricing, selection or privileged access. |
| An admin changes a store reward's points price | Subsequent accepted redemptions use the applicable displayed price; prior redemption costs remain unchanged. |
| A fan successfully redeems a priced merchandise discount | Create one redemption and one matching debit; show demo voucher status in the POC. |
| Admin tree price is 300 and fan balance is 500 | Create one individual tree request assigned to that account/name, deduct 300 once and leave 200. |
| An individual tree request is reassigned because its original country cannot fulfil it | Preserve identity and account association, update its pending planting destination and do not imply that an existing tree was relocated. |
| A fan inspects a demonstration tree redemption | Distinguish points spent and pending/demo planting from confirmed planting and carbon removal. |
| Another fan requests a private journey trace | Deny access; shared progress across the owner's devices does not make the trace public. |
| A trace reaches the agreed seven-day retention deadline | Remove it from the relevant application storage under the implemented policy while preserving allowed summaries and points history; validate the deadline's origin after it is decided. |
| A fan signs in on another device after credit or spending | Read the same account progress and balance without duplicate operations. |

> [!WARNING]
> Do not hardcode unresolved policy into acceptance tests and then treat passing tests as product approval. Add exact boundary, overnight, tie/resubmission and tree-exception cases after the relevant team decision. Zero/negative reduction and fractional-point behavior follow the calculation proposal only if that proposal is confirmed.

## Out of Scope

- App-store publication, public hosting, production deployment, commits and pushes under this specification-writing task. Creating or editing planning documents and issues does not authorize releasing the app.
- International flights or getting a fan to the host country; this first journey begins when the fan is already in the host location.
- Arbitrary everyday destination entry for this first race-focused feature, while retaining it as a possible later extension.
- Guaranteed routing for every calendar event, unrestricted future schedules, automatic cab-plus-transit trip composition, or invented live data when coverage is absent.
- Replacing required actual movement tracking with a simulated journey; simulated inputs are appropriate for labelled fixtures and automated tests only.
- Claiming transport-mode proof, verified carbon savings, offsets or immediate carbon removal from tree redemptions.
- Buying points with money, cash-funded challenges or a cash payout system; challenge funding in this core means earned points.
- A fixed challenge funding target, treating the submission fee as votes, or refunding the 500-point fee/contributions for rejected or backlogged challenges.
- Guaranteed driver performances, real voucher inventory, merchandise purchase/checkout fulfilment, real planting or carbon-credit delivery without separate arrangements.
- Fan teams, shared goals, exclusive content, accommodation and food recommendations, group viewing and energy-saving actions.
- Optional quotes, public tree dedications, free challenge resubmission, or automatic failed-tree refunds as assumed approved features. Their policies remain open rather than silently included.
- A final branding redesign or final screen direction; UI selection remains a separate decision before real screens are implemented.

## Further Notes

### Decisions to carry into the team discussion

> [!WARNING]
> **Carbon and earning precision:** confirm the one-person driving baseline, treatment of non-positive differences, whole-point rounding, operational/upstream boundary, consistent CO₂e units, occupancy, factor sources and versions, and disclosed proxies for each location/mode. Do not present an unselected factor set as verified Singapore data. This blocks final real-route carbon awards, not independent account or challenge work.

> [!WARNING]
> **Journey eligibility and evidence:** define exact Thursday/Monday endpoint inclusivity, ownership of overnight journeys, race entrance coordinates, return destination behavior, arrival radius/evidence, acceptable location gaps, interrupted-journey handling and repeat-claim checks. Attribution to the start day and arrival strictly before Monday 06:00 are discussion proposals, not confirmed defaults.

> [!WARNING]
> **Challenge moderation and sessions:** decide whether rejected ideas can be edited/resubmitted and whether another fee applies; set the exact stage cutoff, tie resolution, zero-vote/fewer-than-three treatment, postponed appearances, and which backlogged challenges enter later selections. The original 500 points never return; approval remains necessary; no free resubmission is assumed.

> [!WARNING]
> **Tree identity and exceptions:** decide optional-quote scope, name visibility, behavior after account-name changes, country-change notification or choice, equivalent pricing between projects, and what happens if no project can fulfil a request. Every tree is account-assigned. The challenge no-refund rule does not resolve a failed tree request.

> [!WARNING]
> **Reward economics and delivery:** admins still need to set store and tree prices. Agree merchant terms, planting funding, fulfilment ownership and whether sponsorship plus incremental merchandise sales is the chosen revenue hypothesis. Points spent are not cash revenue; no commercial arrangement is established. Typical local journey earnings have not been measured, so do not promise that any reward is attainable within a particular time.

> [!WARNING]
> **Implementation choices and verification:** select Azure services and compatible email authentication; verify calendar ingestion and Maps coverage; test actual iOS/Android background travel; define trace-retention timing, cleanup coverage and access policy. Select a UI direction before implementing real screens. These checks remain unverified by documentation review or the static mockups.

### Source precedence and research limits

- The initial user-supplied AI extraction attributed the idea to meeting notes from 22 and 24 September 2026 and later follow-up messages on 24 September. Original meeting documents were not inspected. Later direct user clarifications take precedence, particularly race-local travel, live background tracking, the points rate/cap, daily allowance, non-refundable submission fee, top-three selection and individual tree redemptions.
- Use the glossary's meanings for race journey, race weekend, daily journey allowance, estimated emissions reduction, provisional journey points, challenge contribution, challenge submission fee, challenge backlog, fan interaction session, tree redemption and planting reassignment.
- No ADRs or application tests were found during the bounded repository inspection. Existing planning documents and HTML callouts supplied the requirements; mockup values are illustrative rather than independent product decisions.
- The [official F1 calendar](https://www.formula1.com/en/racing/2026) is the event reference, not a source of verified circuit entrances or driver-stage schedules.
- [Google transit routing](https://developers.google.com/maps/documentation/routes/transit-route) documents transit journeys with walking connections and future searches up to 100 days; actual availability still needs verification. [Google eco-routing](https://developers.google.com/maps/documentation/routes/eco-routes) does not establish a universal passenger-carbon estimate for all the requested modes.
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/#background-location) and [TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/) document background location requirements. Native development builds and physical-device checks are necessary; user termination and Android device behavior limit continued tracking.
- Azure is the selected backend platform. Specific Azure services, transaction design and authentication provider still need selection and verification before implementation.
- The [UK 2025 greenhouse-gas conversion methodology](https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf) helps distinguish units and boundaries. It is not an approved factor dataset for Singapore or every host location.
- Aston Martin's [2024 Make A Mark report, pp. 35–36](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=35) reports 1,500 trees at the AMR Technology Campus. Its [2025 report, p. 26](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=26) describes North Ethiopian Highlands woodland/agroforestry and Mtwapa Creek mangrove restoration in Kenya. These are reported facts from selected pages of two official reports, not an independent planting audit or an established app partnership. Do not attribute team/project carbon totals to this app.
- The existing [I / AM membership](https://www.astonmartinf1.com/en-GB/IAM) and [team partnerships](https://www.astonmartinf1.com/en-GB/partners) provide business context, not evidence that this proposed app earns money or has funded rewards.

Prepared from the conversation and current project documents on 25 September 2026. Specification and test scenarios only; no app implementation, runtime tests or real fulfilment have been completed by this task.
