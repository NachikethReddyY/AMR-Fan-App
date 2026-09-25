# Aston Martin fan app: product specification

Status: revised after Meeting 3 and the user's interview answers, including the clarity-review follow-up. The points/rewards design and reset policy are confirmed. Journey calculation policy and ESG totals remain explicitly deferred; other implementation handoffs are listed below. This task authorizes documentation only.

## Product idea

Help Aston Martin fans engage with ESG through sustainable travel, rewards and a dashboard showing team activity alongside their personal contribution record. Fans choose ordinary journey starts and destinations; a race is one possible destination. The prototype uses a populated demo account, simulated journeys and populated dashboard data.

Sources: `meet 3.pdf`, especially pp. 9 and 13–15, and the user's meeting and clarity-review interview answers. See [source comparison and decision record](meeting-3-reconciliation.md). Direct user answers take precedence over meeting ambiguities and earlier requirements.

## Confirmed experience and feature inventory

| Area | Required experience | Current scope |
| --- | --- | --- |
| Demo account | Populated examples showcase travel, points, all reward types and ESG activity. | One persistent demo profile per signed-in user, starting at 0 points; complete simulated journeys, spend points and update History/dashboard records. Real-user accounts are also in scope. |
| Journey planning | Choose a start and destination; compare travel duration and estimated emissions. | Prototype: Singapore first. Ordinary non-race destinations are supported. |
| Route recommendation | Let the fan set acceptable extra travel time and recommend the lowest-emission available route within it. | Prototype. Comparison reference, units and tie handling need precise definition. |
| Country-specific mode comparison | Calculate estimated emissions for bus, train, car, electric car and cab using data for the journey's country; retain walking/cycling where supported. | Prototype: Singapore factors first, with country-specific records for later expansion. Datasets and car fuel distinctions remain open. |
| Journey progress | Demonstrate journey progress and completion through clearly labelled simulation. | Prototype. Real background tracking moves to later work. |
| Points | Show travel rewards and the fan's points balance using demo data. | Retain 50 points per estimated kg reduction and the 2,000-point journey cap. No daily trip-count limit. |
| Rewards | Exactly two tabs: Redemption and History. | Prototype. No new reward-category tabs are implied. |
| Tree redemption | Redeem participation in an existing tree programme, with demonstration status until actual allocation is arranged. | Admin-priced programme participation under the account name; no quote or country reassignment. It does not promise an additional planted tree. |
| Driver questions | Offer the opportunity to submit a question to a driver. | Submit for admin review; show status in History; redemption does not guarantee an answer. |
| Exclusive content | Offer exclusive fan content, including off-season content. | Admin-priced; redeemed content stays unlocked for the purchasing account. |
| Fan challenges | Preserve driver/team challenges as a distinct reward type. | 500-point submissions/resubmissions; admin approval; positive-contribution ranking; up to three selected at admin session close, with earliest approval breaking ties. |
| Store | Preserve merchandise discount rewards. | Included under Rewards; earlier discount range/admin pricing remain recorded decisions. |
| Rewards history | Present the fan's reward activity and status in History. | Prototype: reflect interactive reward transactions and prepared demo history. |
| Fan ESG dashboard | Present team ESG activity and the fan's own contribution record using the database the team will populate. | Prototype: user requested total savings; definition and other metrics deferred for their follow-up. |
| Admin web dashboard | Provide a separate web experience for administration. | Manage reward prices/content, earning rules, reason-recorded balance adjustments, questions/challenges, ESG figures, emission factors and demo-data reset. |
| AI action evidence scoring | Images, text, video and voice descriptions of sustainable actions. | Slides-only future proposal. |
| Campaigns and leaderboards | Regional campaigns and regional/individual comparisons. | Slides-only future proposal. |
| Chatbot/voice assistant | Points queries or navigation help. | Meeting brainstorm; not required prototype scope. |

## Journey and emissions requirements

- Ordinary journeys must not require race selection. The previous Thursday-to-Monday reward window and race-local outbound/return rule do not define ordinary travel eligibility.
- Compare the transport options actually available for the selected endpoints. Missing route or emissions data must remain explicit rather than become invented live results.
- The user confirmed the time-tolerance recommendation rule. Proposed detail for confirmation: measure the allowed extra minutes against the fastest available candidate, then minimize emissions within that duration limit.
- Use country-specific transport emissions inputs. A country name alone is insufficient provenance: record each factor's transport mode, unit, source, reference period and assumptions before using it.
- The requested “CO2 cost” means the emissions estimate here, not the ticket fare. CO2 versus CO2e, passenger versus vehicle units, occupancy, electricity assumptions and the comparison baseline remain technical/product decisions to resolve before final calculations.
- Keep route estimates, journey simulation and actual completed travel distinct. Demo completion cannot establish real emissions reductions.
- Preserve existing earned balance when a provisional journey estimate changes. Interactive operations must prevent duplicate journey credit, double spending and negative balances, and keep History consistent with the balance.
- Actual background tracking and physical-device journey validation belong to the later implementation plan. They are not acceptance conditions for this simulated prototype.

## Accounts and interactive state

Both the interactive demo account and real-user accounts are in scope. Every new real account and demo profile starts at 0 points. Populated demo catalogues and dashboard examples do not grant spendable points or fabricate personal point transactions. Retain the earlier email-account and shared-progress requirements; the authentication provider remains a later implementation selection.

The demo account must support simulated journey completion, point spending and updates to Rewards History and applicable personal dashboard records. Persist the resulting state consistently; repeated requests must not duplicate credit or spending. Demo activity remains distinguishable from real activity. Only the demo account earns simulated journey points. Real accounts can plan routes but cannot receive journey awards from simulation; real travel earning depends on later tracking. Authorized admin balance adjustments are a separate operation. Real accounts can spend admin-granted points, with no automatic starter points; vouchers, tree participation and driver outcomes remain explicitly demonstration fulfilment.

Each signed-in user has one persistent demo profile, reused across devices and visits. Personal balances, History and content access remain independent. A new session resumes that profile without issuing starter points. Challenge rankings are intentionally shared by demo and real accounts: their contributions affect the same totals and selections seen by everyone.

Reset preserves the selected demo profile's purchased rewards, unlocked content, challenge submissions, all point History, shared contribution records and existing selections. It restarts simulated journeys and dashboard examples. It neither removes nor duplicates shared votes, and leaves other accounts' personal state unchanged. With all starting balances now 0, reset returns the balance to 0: append a reason-recorded reset entry showing the removed balance and resulting 0 rather than deleting past transactions. Repeated reset at 0 cannot credit points. Reset cancels unfinished simulated journeys. Unfinished purchases and contributions require fresh confirmation; late pre-reset requests cannot award or spend points. Completed outcomes remain recorded, and retries return their original result without another charge. A retry of a completed reset must not clear later earnings. The earlier restoration of unspent starter points is superseded.

## Points rules

The initial earning settings remain 50 points per estimated kg of emissions reduction and a 2,000-point cap per eligible journey. Admins may change earning rules; these values are initial settings rather than permanently fixed constants. For example, 10 kg gives 500 points and 60 kg reaches the 2,000-point cap. These are arithmetic examples, not typical Singapore journey estimates.

Travel across the supported country is eligible in the product concept, without race-destination or race-weekend restrictions. There is no daily trip-count limit, as explicitly confirmed by the user. Each journey retains its own configured cap, initially 2,000 points; duplicate credit for the same journey remains prohibited. Only the demo account receives simulated journey awards in this version.

At Start journey, retain the earning-rule and emissions-factor versions selected for that journey. Completion uses those versions even if an admin changes the active settings during travel. New journeys use the updated versions; completed awards never change retroactively.

The user asked whether AI can calculate emissions. Recommended approach after the user requested advice: code calculates emissions from sourced country/mode factors and route distances, then applies the configured points rules; AI explains the route trade-offs using those calculated results. This approach, the comparison baseline, rounding and precise time-tolerance policy remain pending; the question does not approve unconstrained model-generated factors or point amounts.

## Rewards requirements

Redemption contains tree participation, driver questions, exclusive content, challenges and store offers. History contains every point change, including journey awards, reward spending and admin adjustments, with its reason and resulting balance, alongside reward statuses. The user selected these two tabs; detailed layouts remain a later design task.

Tree participation uses an existing programme. A seeded or newly created demo participation record must retain demonstration status until actual allocation is arranged. Do not label point spending as a newly planted tree or verified carbon offset. The participation record uses the account name at an admin-set points price. Quotes and country reassignment are excluded from this demo flow; the historical new-planting reassignment proposal no longer applies.

A challenge costs 500 non-refundable points to submit, requires admin approval before contributions, accepts contributions of at least 10 points, and excludes submission fees from ranking. An admin explicitly closes a fan-interaction session and selects up to three approved unfinished challenges with positive contributions, ordered by contributed points and then earliest approval. Zero-contribution challenges are not selected; if fewer than three qualify, select only those that qualify. Unselected challenges keep their points for later sessions, without refunds.

A rejected challenge may be resubmitted only as a new paid submission: show the new 500-point charge before confirmation and retain the original rejected submission and non-refundable charge. Approval, selection and performance remain distinct states. Selection freezes further contributions and excludes the challenge from later selections until an admin marks it performed or releases it back to the backlog. Performed challenges remain excluded; releasing an unfinished challenge restores backlog eligibility with its contributed points retained.

Store discounts remain 10%–60% with admin-set points prices.

If an admin changes a reward price before purchase confirmation, display the new price and require confirmation again. Do not debit points or create a redemption using stale confirmation. Completed purchases retain their original prices and records.

Driver-question redemption submits the question for admin review, displays its status in History and does not guarantee an answer. Admins set question prices. The submitted question fee is non-refundable even if rejected or unanswered. Admins also set exclusive-content prices; redeemed content stays unlocked for that account. Detailed fulfilment status transitions remain to be finalized.

Fans may redeem multiple tree participations and store vouchers and submit separate paid driver questions. Each intentional repeat is a new purchase; replaying a request never charges again. Exclusive content already unlocked for the account must not be charged again.

If an offer is disabled before confirmation, reject the new purchase without charging. Preserve earlier redemptions, History and previously purchased content access.

An admin correction appends a new reason-recorded adjustment rather than editing or deleting the original point transaction. Point removal cannot make the balance negative and does not automatically revoke a previously obtained reward. Preserve both the original record and the correction.

## Dashboards and populated data

The fan ESG dashboard and admin web dashboard are separate experiences. The fan ESG dashboard reads the database the team will populate; a live ML report-ingestion pipeline is not required by this answer.

Team ESG records and personal demo activity must remain distinguishable. Proposed record metadata includes source, reporting year, unit and demo status; the user requested total savings but deferred its precise definition and the other metrics. Do not invent whether this means personal or community totals, its period, or its baseline. Seeded personal activity is not proof that it appears in Aston Martin's official annual report.

The user confirmed all proposed admin controls: reward prices/content, earning rules, manual point additions/removals with a recorded reason, question/challenge management, ESG figures, transport emissions factors and demo-data reset. Demo reset must remain confined to demo data, preserving real-user balances, history and content entitlements. Rule and factor changes must preserve the recorded basis of historical awards; in-progress journeys retain their Start journey versions. Existing assigned-admin authorization remains protected; the demo account must not acquire admin powers merely by displaying a badge.

## Acceptance examples for confirmed decisions

These are proposed verification cases for future implementation, not executed application tests.

| Scenario | Expected observation |
| --- | --- |
| Fan enters an ordinary non-race destination | Route planning accepts it within supported coverage. |
| Fan opens Rewards | Redemption and History are the two tabs. |
| Fan opens Redemption using the demo account | Tree participation, driver questions, exclusive content, challenges and store rewards are represented. |
| Fan opens History | Personal transactions and reward statuses are consistent with the account balance; prepared illustrative records are labelled separately and do not create spendable points or purchased rights. |
| Fan starts a demo journey | Simulation is clear; no claim of actual GPS-verified travel is made. |
| Fan views a demo tree record | It describes programme participation and remains a demonstration pending actual allocation. |
| Fan compares routes in a supported country | Bus, train, car, electric car and cab estimates use that country's applicable data where those options are available. |
| Fan changes acceptable extra travel time | Recommendation remains within the chosen tolerance and minimizes estimated emissions among qualifying candidates. |
| A country's mode factor is missing | The corresponding estimate is unavailable or uses a separately approved, disclosed fallback. Zero is not invented. |
| Team updates populated dashboard records | Dashboard displays the applicable stored records after authorized admin edits. |
| A fan sees a personal travel estimate beside a team ESG figure | Labels preserve the distinction between personal demo activity and team-reported outcomes. |
| An ordinary fan accesses administration | Protected admin operations remain unavailable. |
| Demo fan completes a simulated journey and spends its credited points | Balance, History and applicable dashboard records update consistently with demo status retained. |
| A completed demo operation is retried | It produces no second award or spend. |
| A real user signs in | Their own account/progress is available; demo records do not become their real activity. |
| Fan submits a driver question through Rewards | It enters admin review and appears in History without a guaranteed-answer claim. |
| Eligible journey has 10 kg estimated reduction under initial earning settings | Credit 500 points once under the final eligibility policy. |
| Eligible journey has 60 kg estimated reduction under initial earning settings | Credit no more than 2,000 points once. |
| Real account completes a simulated journey | Award no simulated points to that account. |
| Admin adjusts a balance | Record the authorized change and its reason; preserve transaction history and the non-negative balance invariant. |
| Admin resets demo data | Reset only the selected persistent demo profile; preserve its rewards, submissions and History, shared votes/selections and other accounts' personal state. Return the balance to 0 with a reset entry; cancel unfinished journeys and require fresh purchase confirmation. |
| Submitted driver question is rejected or remains unanswered | Keep the fee deducted and show the corresponding status. |
| Fan returns to previously redeemed exclusive content | Content remains unlocked for that account. |
| Admin changes the rate from 50 to 25 points/kg while a journey is active | That journey completes with its start version of 50; a new journey uses 25. Historical awards remain unchanged. |
| Admin changes an emissions factor while a journey is active | Complete the active journey using the factor version retained at Start journey. |
| Demo user A spends points or resets progress | Demo user B's personal balance and History remain unchanged. Challenge contributions intentionally affect the shared ranking; reset preserves those contributions and grants no starter points. |
| A new real account signs in without an admin grant | It receives no automatic starter points and cannot earn simulated journey points. |
| Admin grants a real account points and the fan redeems a reward | Deduct points once; record History; disclose demonstration fulfilment for vouchers, trees and driver outcomes. |
| Fan redeems tree participation | Display the admin price and record participation under the account name, without quote or country-reassignment controls. |
| Admin closes a session with two approved unfinished positive-contribution challenges and a zero-vote challenge | Select the two qualifying challenges; exclude the zero-vote challenge. |
| Two qualifying challenges tie on contributed points | Rank the earlier-approved challenge first. |
| An approved challenge is not selected | Preserve its contributions in the backlog for later sessions without refunds. |
| Fan resubmits a rejected challenge with 600 points | Show the 500-point charge, then create a new submission with 100 points remaining after confirmation; retain the original rejection and fee. |
| Admin changes an offer from 100 to 150 points before confirmation | Display 150 and require fresh confirmation; make no debit or redemption from the stale confirmation. |
| Admin changes an offer after completed redemption | Preserve the completed redemption's accepted price and history. |
| Fan attempts to contribute to a selected challenge | Reject without changing balance or challenge total. |
| A selected challenge is considered for another session | Exclude it until the admin resolves its current selection. |
| Admin marks a selected challenge performed | Keep its history and exclude it from later selections. |
| Admin releases a selected unfinished challenge to the backlog | Restore contribution/selection eligibility and retain its contributed points and history. |
| Fan opens History after a journey award, purchase and admin adjustment | Show each point change, reason and resulting balance alongside reward statuses. |
| Fan intentionally buys a second tree participation or store voucher, or submits another paid question | Create a separate charged purchase, distinct from a retry. |
| Fan requests exclusive content already unlocked | Preserve access without another charge. |
| A demo fan contributes to a challenge | Deduct from that demo balance and increase the same shared ranking used by real accounts. |
| An offer is disabled before purchase confirmation | Refuse without charge; preserve prior redemptions and content access. |
| Admin corrects an erroneous point transaction | Append a reason-recorded adjustment; keep the original and existing reward; refuse a deduction that would make balance negative. |
| A new demo profile is created | Balance starts at 0; populated catalogue/dashboard examples do not credit the balance. |
| Demo user returns on another device or after signing in again | Resume the same demo profile and its current balance, rewards and History; issue no starting points. |
| Demo earns or receives 1,000 points, buys content for 400, contributes 300, then resets | Preserve content access, the 300 shared votes, selections, submissions and all History. Balance becomes 0 with a reset debit of 300. |
| That demo resets again without further activity | Preserve rights and shared votes; never create starter points or duplicate contributions. |
| Reset occurs while a simulated journey or purchase is unfinished | Cancel the journey; require fresh purchase confirmation; reject late pre-reset awards/spending. Preserve already committed outcomes. |
| A completed reset is retried after a new award | Return its recorded outcome; do not clear the new points or append another reset debit. |

## Calculation policy deferred for later review

Use repeatable code for distance-times-factor calculations and point awards. AI receives the calculated route results and explains why an option fits the fan's time tolerance. Recommend a one-person conventional-car journey over the same endpoints as the comparison baseline. Singapore-specific factor selection and compatible units still require verification; no numerical factors have been selected here.

Activity-based calculations using transport distance and conversion factors are an established estimation method, as described by [UK government reporting guidance](https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting). That reference supports the method, not the use of UK factors for Singapore. The user explicitly deferred the complete calculation policy for later review, including code/AI responsibility, baseline, rounding, time reference and tie handling. These recommendations are not approved requirements and are not prerequisites for discussing reward spending or admin-granted points.

## Confirmed architecture and remaining work

- User-deferred: complete journey calculation policy, including AI responsibility, baseline, rounding, time reference and tie handling. Revisit later, not in the current rewards interview.
- Confirmed: one backend points/rewards module owns balances, reward outcomes, History and reset. Its authenticated interface is shared by fan/admin callers. See [the agreed module design](points-rewards-design.md). Zero-start accounts, persistent demo identity and reset execution are settled.
- Deferred by user: exact dashboard total-savings definition, reporting period and remaining metrics. This does not block other documentation.

Country-factor selection is follow-up research work, not a request for the user to supply facts. Remaining dependent decisions include the exceptions listed above, data retention in the simulated prototype and the AI team's integration contract. Tree participation naming and removal of quotes/reassignment are settled. Existing research and historical rules below are retained for that reconciliation.

## Earlier specification: historical record

Everything below records the previous race-first specification. It preserves provenance and unresolved rules; where it conflicts with the revised requirements above, the revised requirements take precedence. It is not an additional prototype checklist.

## Problem Statement

> [!IMPORTANT]
> **Specification only — do not build yet.** This document records future product requirements and the approved testing approach. The user explicitly instructed that no app work be built at this stage. Wait for a separate instruction to begin building. Implementation work belongs in separately scoped issues.

An Aston Martin F1 fan travelling locally to a race needs to compare practical transport options, understand their estimated carbon impact, and receive meaningful recognition for choosing lower-emission travel. Today, the proposed experience has no single flow connecting race selection, route comparison, actual journey tracking, a trustworthy points balance, and participation with the team.

The fan also needs a reason to return to the wider fan app: proposing or supporting driver/team challenges, earning merchandise discounts, and supporting individual tree-planting requests. Those benefits must distinguish points spent from real-world fulfilment so that a demo never looks like an established voucher, driver, or planting commitment.

This specification describes future product workflows. The repository now contains an Expo/React Native starter, planning documents and static screen-direction mockups; the starter does not implement these product workflows. The intended audience in this earlier scope includes fans and assigned Aston Martin admins.

## Solution

Build an Expo/React Native fan app for iOS and Android, with Convex as the backend direction and Google Maps as the intended routing integration. The first feature is local travel from the fan's current location to a race selected from the F1 calendar, including return travel from that race.

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
- Use Expo and React Native for both iOS and Android. Google Maps is the intended route provider. Convex is the backend direction. Email-based accounts and progress shared across devices are agreed; a specific authentication provider is not yet selected.
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
- Conceptual responsibilities are race/route planning, journey tracking and assessment, the points balance, fan challenges, the rewards store, tree requests, and account/admin access. These describe the behavior being built; a separate service or package for each is not required. Keep related Convex behavior together and avoid unnecessary infrastructure.

## Testing Decisions

### Agreed testing boundary

**Confirmed by the user:** use one authenticated Convex application boundary with controlled time, Maps responses and location samples, plus real background-tracking and arrival checks on physical iOS and Android devices. These tests describe future implementation work; creating this specification does not authorize building or scaffolding the app.

- Prefer **one primary automated boundary: authenticated Convex application operations and the results observable to fans/admins**. Drive journey assessment and completion, point credit/spending, challenges, redemptions and subsequent reads through that public application boundary. Assert visible state, returned outcomes, balances and permissions rather than internal helpers, table layouts, call counts or private implementation details.
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
> **Implementation choices and verification:** choose compatible email authentication for Convex; verify calendar ingestion and Maps coverage; test actual iOS/Android background travel; define trace-retention timing, cleanup coverage and access policy. Select a UI direction before implementing real screens. These checks remain unverified by documentation review or the static mockups.

### Source precedence and research limits

- The initial user-supplied AI extraction attributed the idea to meeting notes from 22 and 24 September 2026 and later follow-up messages on 24 September. Original meeting documents were not inspected. Later direct user clarifications take precedence, particularly race-local travel, live background tracking, the points rate/cap, daily allowance, non-refundable submission fee, top-three selection and individual tree redemptions.
- Use the glossary's meanings for race journey, race weekend, daily journey allowance, estimated emissions reduction, provisional journey points, challenge contribution, challenge submission fee, challenge backlog, fan interaction session, tree redemption and planting reassignment.
- No ADRs or application tests were found during the bounded repository inspection. Existing planning documents and HTML callouts supplied the requirements; mockup values are illustrative rather than independent product decisions.
- The [official F1 calendar](https://www.formula1.com/en/racing/2026) is the event reference, not a source of verified circuit entrances or driver-stage schedules.
- [Google transit routing](https://developers.google.com/maps/documentation/routes/transit-route) documents transit journeys with walking connections and future searches up to 100 days; actual availability still needs verification. [Google eco-routing](https://developers.google.com/maps/documentation/routes/eco-routes) does not establish a universal passenger-carbon estimate for all the requested modes.
- [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/#background-location) and [TaskManager](https://docs.expo.dev/versions/latest/sdk/task-manager/) document background location requirements. Native development builds and physical-device checks are necessary; user termination and Android device behavior limit continued tracking.
- [Convex's React Native client](https://docs.convex.dev/client/react-native), [authentication overview](https://docs.convex.dev/auth/overview), [transactional mutations](https://docs.convex.dev/functions/mutation-functions) and [scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions) support the intended backend direction. Convex Auth is documented as beta; the provider is still undecided.
- The [UK 2025 greenhouse-gas conversion methodology](https://assets.publishing.service.gov.uk/media/6846b0870392ed9b784c0187/2025-GHG-CF-methodology-paper.pdf) helps distinguish units and boundaries. It is not an approved factor dataset for Singapore or every host location.
- Aston Martin's [2024 Make A Mark report, pp. 35–36](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=35) reports 1,500 trees at the AMR Technology Campus. Its [2025 report, p. 26](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=26) describes North Ethiopian Highlands woodland/agroforestry and Mtwapa Creek mangrove restoration in Kenya. These are reported facts from selected pages of two official reports, not an independent planting audit or an established app partnership. Do not attribute team/project carbon totals to this app.
- The existing [I / AM membership](https://www.astonmartinf1.com/en-GB/IAM) and [team partnerships](https://www.astonmartinf1.com/en-GB/partners) provide business context, not evidence that this proposed app earns money or has funded rewards.

Prepared from the conversation and current project documents on 25 September 2026. Specification and test scenarios only; no app implementation, runtime tests or real fulfilment have been completed by this task.
